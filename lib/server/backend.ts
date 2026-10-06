/**
 * Jalur server-side frontend → backend API (hanya untuk route handler).
 *
 * Mengapa proxy, bukan browser langsung ke :4010 (4 Okt 2026):
 *   - Backend bisa mewajibkan `Authorization: Bearer <API_WRITE_TOKEN>` untuk
 *     setiap POST/PUT/PATCH/DELETE. Token itu hanya boleh hidup di environment
 *     server — bukan di bundle browser, localStorage, atau Git. Proxy inilah
 *     yang menempelkannya, dan hanya pada permintaan yang mengubah data.
 *   - Galat jaringan ke backend dibedakan dari galat backend itu sendiri
 *     (`kind: upstream_unreachable | upstream_timeout`).
 *
 * Pagar: Host harus loopback (menolak DNS rebinding), dan permintaan yang
 * mengubah data harus same-origin (menolak CSRF dari situs lain).
 *
 * `node:http` dipakai alih-alih `fetch` karena fetch Node memutus jawaban
 * setelah 300 detik, sementara scan crypto/overnight pernah 320–382 detik.
 */
import http from "node:http";
import https from "node:https";

export const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ALLOWED_METHODS = new Set(["GET", ...MUTATING_METHODS]);
const DEFAULT_ALLOWED_HOSTS = ["127.0.0.1", "localhost", "::1"];
const MAX_BODY_BYTES = 1_000_000;

export interface BackendConfig {
  upstream: URL;
  writeToken: string | null;
  timeoutMs: number;
  allowedHosts: string[];
}

export function backendConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): BackendConfig {
  const raw = env.TRADING_API_URL || env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4010";
  const upstream = new URL(raw.endsWith("/") ? raw : `${raw}/`);
  const token = (env.API_WRITE_TOKEN ?? "").trim();
  const timeout = Number(env.TRADING_API_TIMEOUT_MS);
  const extraHosts = (env.FE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return {
    upstream,
    writeToken: token || null,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 15 * 60_000,
    allowedHosts: [...DEFAULT_ALLOWED_HOSTS, ...extraHosts],
  };
}

/** "127.0.0.1:4011" → "127.0.0.1"; "[::1]:4011" → "::1". */
export function hostnameOf(hostHeader: string | null): string | null {
  if (!hostHeader) return null;
  try {
    return new URL(`http://${hostHeader}`).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return null;
  }
}

/** null = lolos; selain itu alasan penolakan. */
export function guardRequest(request: Request, cfg: BackendConfig): string | null {
  const host = request.headers.get("host");
  const hostname = hostnameOf(host);
  if (!hostname || !cfg.allowedHosts.includes(hostname)) {
    return `Host '${host ?? ""}' tidak diizinkan`;
  }
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return null;

  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      return "Origin tidak sah";
    }
    return originHost === host!.toLowerCase() ? null : `Origin '${origin}' bukan origin UI ini`;
  }
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin") return null;
  return "Permintaan perubahan data wajib same-origin (Origin tidak ada)";
}

export function jsonResponse(status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extra },
  });
}

export interface UpstreamResult {
  status: number;
  contentType: string | null;
  body: Buffer;
}

export class UpstreamError extends Error {
  constructor(
    readonly kind: "upstream_unreachable" | "upstream_timeout",
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Satu permintaan ke backend. Melempar `UpstreamError` bila tak terjawab. */
export function callUpstream(
  target: URL,
  init: { method: string; headers: Record<string, string>; body?: Buffer; timeoutMs: number },
): Promise<UpstreamResult> {
  const transport = target.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = transport.request(
      target,
      { method: init.method, headers: init.headers, timeout: init.timeoutMs },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 502,
            contentType: (res.headers["content-type"] as string | undefined) ?? null,
            body: Buffer.concat(chunks),
          }),
        );
        res.on("error", (e) => reject(new UpstreamError("upstream_unreachable", "ERESPONSE", e.message)));
      },
    );
    req.on("timeout", () => {
      req.destroy(new UpstreamError("upstream_timeout", "ETIMEDOUT", `tidak ada jawaban dalam ${init.timeoutMs} ms`));
    });
    req.on("error", (e: NodeJS.ErrnoException) => {
      reject(e instanceof UpstreamError ? e : new UpstreamError("upstream_unreachable", e.code ?? "EUPSTREAM", e.message));
    });
    if (init.body && init.body.length) req.write(init.body);
    req.end();
  });
}

function safeSegments(segments: string[]): string[] | null {
  for (const s of segments) {
    if (!s || s === "." || s === ".." || /[\\/]/.test(s)) return null;
  }
  return segments.map(encodeURIComponent);
}

/**
 * Teruskan satu permintaan browser ke backend. Header masuk tidak diteruskan
 * kecuali Content-Type/Accept: cookie atau Authorization dari browser tidak
 * pernah sampai ke backend; Authorization hanya berasal dari environment.
 */
export async function proxyToBackend(
  request: Request,
  segments: string[],
  cfg: BackendConfig = backendConfigFromEnv(),
): Promise<Response> {
  const method = request.method.toUpperCase();
  const proxyHeader = { "x-fe-proxy": "1" };
  if (!ALLOWED_METHODS.has(method)) {
    return jsonResponse(405, { detail: `Metode ${method} tidak didukung proxy` }, proxyHeader);
  }
  const rejected = guardRequest(request, cfg);
  if (rejected) return jsonResponse(403, { detail: rejected, kind: "proxy_forbidden" }, proxyHeader);

  const safe = safeSegments(segments);
  if (!safe) return jsonResponse(400, { detail: "Path tidak sah", kind: "proxy_bad_path" }, proxyHeader);

  const target = new URL(safe.join("/"), cfg.upstream);
  target.search = new URL(request.url).search;

  const headers: Record<string, string> = { accept: request.headers.get("accept") ?? "application/json" };
  let body: Buffer | undefined;
  if (method !== "GET") {
    const buf = Buffer.from(await request.arrayBuffer());
    if (buf.length > MAX_BODY_BYTES) {
      return jsonResponse(413, { detail: "Isi permintaan terlalu besar" }, proxyHeader);
    }
    body = buf;
    headers["content-type"] = request.headers.get("content-type") ?? "application/json";
    headers["content-length"] = String(buf.length);
    if (cfg.writeToken) headers.authorization = `Bearer ${cfg.writeToken}`;
  }

  try {
    const res = await callUpstream(target, { method, headers, body, timeoutMs: cfg.timeoutMs });
    const noBody = res.status === 204 || res.status === 304;
    return new Response(noBody ? null : new Uint8Array(res.body), {
      status: res.status,
      headers: {
        "content-type": res.contentType ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    const err = e instanceof UpstreamError ? e : new UpstreamError("upstream_unreachable", "EUPSTREAM", String(e));
    return jsonResponse(
      err.kind === "upstream_timeout" ? 504 : 502,
      {
        detail: `Backend API ${cfg.upstream.origin} tidak menjawab (${err.code})`,
        kind: err.kind,
      },
      proxyHeader,
    );
  }
}
