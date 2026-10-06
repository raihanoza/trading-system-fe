/**
 * Isi `GET /api/runtime`: identitas build frontend + status backend.
 *
 * Status backend diperiksa dari server frontend lewat jalur yang sama dengan
 * proxy, jadi "API terhubung" di layar berarti proxy benar-benar bisa
 * menjangkau backend — bukan sekadar browser bisa membuka halaman.
 */
import { sourceFingerprint } from "@/lib/build-identity.cjs";
import type { BackendRuntime, FrontendBuild, RuntimeReport } from "@/types/runtime";
import { callUpstream, UpstreamError, type BackendConfig } from "./backend";

const PROBE_TIMEOUT_MS = 5_000;
const SOURCE_TTL_MS = 60_000;

/** Dibakukan oleh next.config.ts saat build. Kosong = tidak lewat next build/dev. */
export function bakedBuildIdentity(): FrontendBuild | null {
  const raw = process.env.TS_FE_BUILD_IDENTITY;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FrontendBuild;
  } catch {
    return null;
  }
}

let sourceCache: { at: number; root: string; hash: string | null } | null = null;

export function currentSourceHash(root: string, now = Date.now()): string | null {
  if (sourceCache && sourceCache.root === root && now - sourceCache.at < SOURCE_TTL_MS) {
    return sourceCache.hash;
  }
  let hash: string | null;
  try {
    hash = sourceFingerprint(root).hash;
  } catch {
    hash = null; // berkas sedang dipindah OneDrive, dsb.
  }
  sourceCache = { at: now, root, hash };
  return hash;
}

export function resetSourceCache() {
  sourceCache = null;
}

async function probeJson(cfg: BackendConfig, path: string) {
  const res = await callUpstream(new URL(path, cfg.upstream), {
    method: "GET",
    headers: { accept: "application/json" },
    timeoutMs: PROBE_TIMEOUT_MS,
  });
  let json: unknown = null;
  try {
    json = JSON.parse(res.body.toString("utf8"));
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

/** Kontrak dari `/meta/tiers` untuk backend yang belum punya `/system/runtime`. */
async function legacyContract(cfg: BackendConfig): Promise<RuntimeReport["backend"]["contract"]> {
  try {
    const meta = await probeJson(cfg, "meta/tiers");
    const m = meta.json as { spec_hash?: unknown; policy?: unknown; confidence_calibrated?: unknown } | null;
    if (meta.status !== 200 || !m || typeof m.spec_hash !== "string") return null;
    return {
      policy: typeof m.policy === "string" ? m.policy : null,
      spec_hash: m.spec_hash,
      confidence_calibrated: m.confidence_calibrated === true,
      source: "meta/tiers",
    };
  } catch {
    return null;
  }
}

export async function buildRuntimeReport(
  cfg: BackendConfig,
  opts: { root?: string; build?: FrontendBuild | null; now?: () => number } = {},
): Promise<RuntimeReport> {
  const now = opts.now ?? Date.now;
  const build = opts.build === undefined ? bakedBuildIdentity() : opts.build;
  const root = opts.root ?? process.cwd();
  const sourceNow = currentSourceHash(root);

  const backend: RuntimeReport["backend"] = {
    status: "unreachable",
    upstream: cfg.upstream.origin,
    latency_ms: null,
    http_status: null,
    error: null,
    runtime: null,
    health: null,
    contract: null,
  };
  const started = now();
  try {
    const rt = await probeJson(cfg, "system/runtime");
    backend.latency_ms = now() - started;
    backend.http_status = rt.status;
    if (rt.status === 200 && rt.json && typeof rt.json === "object") {
      backend.status = "ok";
      backend.runtime = rt.json as BackendRuntime;
      const tc = backend.runtime.tier_contract;
      backend.contract = tc
        ? { policy: tc.policy, spec_hash: tc.spec_hash, confidence_calibrated: tc.confidence_calibrated, source: "system/runtime" }
        : null;
    } else if (rt.status === 404) {
      // Backend versi lama: endpoint identitas belum ada sampai di-restart.
      const health = await probeJson(cfg, "health");
      backend.http_status = health.status;
      backend.status = health.status === 200 ? "legacy" : "error";
      backend.health = (health.json as RuntimeReport["backend"]["health"]) ?? null;
      backend.error =
        health.status === 200
          ? "Backend belum menyediakan /system/runtime (perlu restart ke versi baru)"
          : `GET /health → ${health.status}`;
      if (health.status === 200) backend.contract = await legacyContract(cfg);
    } else {
      backend.status = "error";
      backend.error = `GET /system/runtime → ${rt.status}`;
    }
  } catch (e) {
    backend.status = "unreachable";
    backend.error = e instanceof UpstreamError ? `${e.code}: ${e.message}` : String(e);
  }

  return {
    checked_at: new Date(now()).toISOString(),
    frontend: {
      ...(build ?? {
        build_id: "unknown",
        built_at: "",
        git_commit: null,
        git_branch: null,
        git_dirty: null,
        git_dirty_files: null,
        source_hash: "",
        source_files: 0,
        next_version: "unknown",
      }),
      node_env: process.env.NODE_ENV ?? "unknown",
      node_version: process.version,
      source_hash_now: sourceNow,
      source_matches_build:
        build && sourceNow ? build.source_hash === sourceNow : null,
    },
    backend,
    proxy: { write_token_configured: Boolean(cfg.writeToken) },
  };
}
