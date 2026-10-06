// @vitest-environment node
/**
 * Klien API terpusat: setiap status penting backend dipetakan ke jenis galat
 * yang bisa dijelaskan ke pengguna, dan klien tidak pernah membawa token.
 */
import { afterEach, describe, expect, it } from "vitest";
import { api, apiRequest, configureApi, resetApiConfig, DEFAULT_API_BASE } from "@/lib/api";
import { ApiError, describeApiError, isApiError } from "@/lib/api-error";
import { jsonResponse } from "./helpers";

type Captured = { url: string; init: RequestInit };

function fakeFetch(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Captured[] = [];
  const impl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return respond(url, init);
  }) as typeof fetch;
  configureApi({ fetch: impl });
  return calls;
}

async function caught(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    if (isApiError(e)) return e;
    throw e;
  }
  throw new Error("tidak melempar");
}

afterEach(() => resetApiConfig());

describe("jalur permintaan", () => {
  it("lewat proxy same-origin, tanpa Authorization dari browser", async () => {
    const calls = fakeFetch(() => jsonResponse(200, { trade_id: 1, status: "closed", outcome: "win", pnl_idr: 5, exit_price: 110 }));
    await api.trades.close(1, 110, "TP");
    expect(DEFAULT_API_BASE).toBe("/api/backend");
    expect(calls[0].url).toBe("/api/backend/trades/1/close");
    expect(calls[0].init.method).toBe("PUT");
    const headers = new Headers(calls[0].init.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.has("authorization")).toBe(false);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ exit_price: 110, notes: "TP" });
  });

  it("memetakan gates_optional menjadi optional_passed (kontrak /signals)", async () => {
    fakeFetch(() => jsonResponse(200, [{ id: 1, gates_passed: ["a"], gates_optional: ["b"] }]));
    const [s] = await api.signals.all(1);
    expect(s.optional_passed).toEqual(["b"]);
    expect(s.gates_failed).toEqual([]);
  });

  it("204/isi kosong mengembalikan undefined", async () => {
    fakeFetch(() => new Response(null, { status: 204 }));
    await expect(apiRequest("/x", { method: "DELETE" })).resolves.toBeUndefined();
  });
});

describe("klasifikasi galat", () => {
  it("401 → unauthorized; petunjuk menyebut token server, bukan browser", async () => {
    fakeFetch(() => jsonResponse(401, { detail: "Token API tidak valid" }));
    const e = await caught(api.trades.close(1, 110));
    expect(e.kind).toBe("unauthorized");
    expect(e.status).toBe(401);
    const d = describeApiError(e, "menutup trade");
    expect(d.title).toContain("401");
    expect(d.hint).toContain("API_WRITE_TOKEN");
    expect(d.hint).toContain("tidak pernah disimpan di browser");
  });

  it("403 paper-trade → paper_mode; 403 lain → forbidden", async () => {
    fakeFetch(() =>
      jsonResponse(403, {
        detail: "Paper-trade mode aktif: pencatatan eksekusi live dinonaktifkan karena edge belum terbukti.",
      }),
    );
    expect((await caught(api.trades.execute(1, 1))).kind).toBe("paper_mode");

    fakeFetch(() => jsonResponse(403, { detail: "Host tidak diizinkan", kind: "proxy_forbidden" }));
    expect((await caught(api.trades.execute(1, 1))).kind).toBe("forbidden");
  });

  it("409 → conflict dengan pesan server", async () => {
    fakeFetch(() => jsonResponse(409, { detail: "Trade ID 1 sudah ditutup" }));
    const e = await caught(api.trades.close(1, 120));
    expect(e.kind).toBe("conflict");
    expect(describeApiError(e, "menutup trade").description).toContain("Trade ID 1 sudah ditutup");
  });

  it("422 Pydantic → validation dengan nama field yang terbaca", async () => {
    fakeFetch(() =>
      jsonResponse(422, {
        detail: [{ type: "greater_than", loc: ["body", "units"], msg: "Input should be greater than 0", input: -1 }],
      }),
    );
    const e = await caught(api.trades.execute(1, -1));
    expect(e.kind).toBe("validation");
    expect(e.issues).toEqual([{ field: "units", message: "Input should be greater than 0" }]);
    expect(describeApiError(e).description).toBe("Units: Input should be greater than 0");
  });

  it("404, 500 → not_found, server", async () => {
    fakeFetch(() => jsonResponse(404, { detail: "Not Found" }));
    expect((await caught(api.system.runtime())).kind).toBe("not_found");
    fakeFetch(() => jsonResponse(500, { detail: "boom" }));
    expect((await caught(api.stats())).kind).toBe("server");
  });

  it("502/504 dari proxy → backend_unreachable / backend_timeout", async () => {
    fakeFetch(() => jsonResponse(502, { detail: "Backend API tidak menjawab (ECONNREFUSED)", kind: "upstream_unreachable" }));
    const down = await caught(api.stats());
    expect(down.kind).toBe("backend_unreachable");
    expect(describeApiError(down).title).toContain("backend API tidak terhubung");

    fakeFetch(() => jsonResponse(504, { detail: "tidak ada jawaban", kind: "upstream_timeout" }));
    expect((await caught(api.scan.crypto())).kind).toBe("backend_timeout");
  });

  it("fetch gagal (server UI mati / jaringan) → network", async () => {
    fakeFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    const e = await caught(api.stats());
    expect(e.kind).toBe("network");
    expect(e.status).toBeNull();
    expect(describeApiError(e).title).toContain("server UI tidak terjangkau");
  });

  it("2xx bukan JSON → bad_response, bukan data kosong", async () => {
    fakeFetch(() => new Response("<html>oops</html>", { status: 200 }));
    expect((await caught(api.stats())).kind).toBe("bad_response");
  });
});
