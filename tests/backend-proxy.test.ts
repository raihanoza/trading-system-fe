// @vitest-environment node
/**
 * Proxy server-side ke backend, diuji lewat HTTP sungguhan ke server palsu:
 * token hanya ditempel di server dan hanya untuk mutasi; Host/Origin asing
 * ditolak; backend mati/lambat dibedakan dari galat backend.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { backendConfigFromEnv, proxyToBackend, type BackendConfig } from "@/lib/server/backend";

const TOKEN = "uji-token-rahasia-123";

interface Seen {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}

let server: http.Server;
let base: string;
const seen: Seen[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ method: req.method!, url: req.url!, headers: req.headers, body });
      if (req.url!.startsWith("/hang")) return; // tidak pernah menjawab
      if (req.url!.startsWith("/trades/1/close")) {
        res.writeHead(409, { "content-type": "application/json" });
        res.end(JSON.stringify({ detail: "Trade ID 1 sudah ditutup" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, path: req.url }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

function cfg(over: Partial<BackendConfig> = {}): BackendConfig {
  return { ...backendConfigFromEnv({ TRADING_API_URL: base, API_WRITE_TOKEN: TOKEN }), ...over };
}

function browserRequest(
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
) {
  return new Request(`http://127.0.0.1:4011/api/backend/${path}`, {
    method: init.method ?? "GET",
    headers: { host: "127.0.0.1:4011", ...init.headers },
    body: init.body,
  });
}

const lastSeen = () => seen[seen.length - 1];

describe("penerusan", () => {
  it("GET diteruskan dengan query, TANPA token walau token terpasang", async () => {
    const res = await proxyToBackend(
      browserRequest("signals/crypto?limit=5", { headers: { authorization: "Bearer dari-browser", cookie: "s=1" } }),
      ["signals", "crypto"],
      cfg(),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, path: "/signals/crypto?limit=5" });
    expect(lastSeen().headers.authorization).toBeUndefined();
    expect(lastSeen().headers.cookie).toBeUndefined();
  });

  it("mutasi same-origin: token server ditempel, token/cookie browser dibuang, body utuh", async () => {
    const res = await proxyToBackend(
      browserRequest("trades/execute", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:4011",
          "content-type": "application/json",
          authorization: "Bearer palsu",
          cookie: "s=1",
        },
        body: JSON.stringify({ signal_id: 7, units: 2 }),
      }),
      ["trades", "execute"],
      cfg(),
    );
    expect(res.status).toBe(200);
    const got = lastSeen();
    expect(got.method).toBe("POST");
    expect(got.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(got.headers.cookie).toBeUndefined();
    expect(JSON.parse(got.body)).toEqual({ signal_id: 7, units: 2 });
    expect(await res.text()).not.toContain(TOKEN);
  });

  it("tanpa token terpasang: mutasi diteruskan tanpa Authorization", async () => {
    await proxyToBackend(
      browserRequest("scan/crypto", { method: "POST", headers: { origin: "http://127.0.0.1:4011" } }),
      ["scan", "crypto"],
      cfg({ writeToken: null }),
    );
    expect(lastSeen().headers.authorization).toBeUndefined();
  });

  it("status galat backend (409) diteruskan apa adanya", async () => {
    const res = await proxyToBackend(
      browserRequest("trades/1/close", {
        method: "PUT",
        headers: { origin: "http://127.0.0.1:4011", "content-type": "application/json" },
        body: JSON.stringify({ exit_price: 120 }),
      }),
      ["trades", "1", "close"],
      cfg(),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ detail: "Trade ID 1 sudah ditutup" });
  });
});

describe("pagar", () => {
  it("Origin situs lain untuk mutasi → 403, backend tidak dipanggil", async () => {
    const before = seen.length;
    const res = await proxyToBackend(
      browserRequest("trades/1/close", { method: "PUT", headers: { origin: "https://example.com" }, body: "{}" }),
      ["trades", "1", "close"],
      cfg(),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).kind).toBe("proxy_forbidden");
    expect(seen.length).toBe(before);
  });

  it("mutasi tanpa Origin dan tanpa Sec-Fetch-Site same-origin → 403", async () => {
    const res = await proxyToBackend(browserRequest("scan/crypto", { method: "POST" }), ["scan", "crypto"], cfg());
    expect(res.status).toBe(403);
    const ok = await proxyToBackend(
      browserRequest("scan/crypto", { method: "POST", headers: { "sec-fetch-site": "same-origin" } }),
      ["scan", "crypto"],
      cfg(),
    );
    expect(ok.status).toBe(200);
  });

  it("Host bukan loopback (DNS rebinding) → 403 bahkan untuk GET", async () => {
    const req = new Request("http://evil.example:4011/api/backend/trades", {
      headers: { host: "evil.example:4011" },
    });
    const res = await proxyToBackend(req, ["trades"], cfg());
    expect(res.status).toBe(403);
  });

  it("segmen path '..' ditolak", async () => {
    const res = await proxyToBackend(browserRequest("x"), ["..", "etc"], cfg());
    expect(res.status).toBe(400);
  });
});

describe("backend tidak menjawab", () => {
  it("port tertutup → 502 upstream_unreachable, tanpa membocorkan token", async () => {
    const closed = http.createServer();
    await new Promise<void>((r) => closed.listen(0, "127.0.0.1", r));
    const port = (closed.address() as AddressInfo).port;
    await new Promise<void>((r) => closed.close(() => r()));

    const res = await proxyToBackend(
      browserRequest("scan/crypto", { method: "POST", headers: { origin: "http://127.0.0.1:4011" } }),
      ["scan", "crypto"],
      cfg({ upstream: new URL(`http://127.0.0.1:${port}/`) }),
    );
    expect(res.status).toBe(502);
    const body = await res.text();
    expect(JSON.parse(body).kind).toBe("upstream_unreachable");
    expect(body).not.toContain(TOKEN);
  });

  it("tidak ada jawaban dalam batas waktu → 504 upstream_timeout", async () => {
    const res = await proxyToBackend(browserRequest("hang"), ["hang"], cfg({ timeoutMs: 300 }));
    expect(res.status).toBe(504);
    expect((await res.json()).kind).toBe("upstream_timeout");
  });
});

describe("konfigurasi", () => {
  it("bawaan 127.0.0.1:4010, timeout 15 menit, token kosong = null", () => {
    const c = backendConfigFromEnv({});
    expect(c.upstream.origin).toBe("http://127.0.0.1:4010");
    expect(c.timeoutMs).toBe(900_000);
    expect(c.writeToken).toBeNull();
  });
});
