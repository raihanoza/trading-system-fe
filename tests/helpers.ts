import type { BackendRuntime, RuntimeReport } from "@/types/runtime";

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function backendRuntime(over: Partial<BackendRuntime> = {}): BackendRuntime {
  return {
    service: "trading-system-api",
    app_version: "2.0.0",
    process: { started_at: "2026-10-04T09:00:00+00:00", pid: 1234, python: "3.11.9" },
    code: {
      git_at_start: { branch: "perbaikan", commit: "c914710" + "0".repeat(33) },
      fingerprint_at_start: { sha256_16: "aaaaaaaaaaaaaaaa", files: 120 },
      fingerprint_now: { sha256_16: "aaaaaaaaaaaaaaaa", files: 120 },
      changed_since_start: false,
      fingerprint_scope: ["api", "core"],
    },
    mode: "paper",
    paper_trade: true,
    execution_note: "Paper: POST /trades/execute ditolak (403); sinyal hanya dicatat dan diukur.",
    tier_contract: {
      policy: "weighted-v1",
      spec_hash: "f553ce3d",
      confidence_calibrated: false,
      score_is_probability: false,
    },
    evaluation_floor: {
      min_terminal: 100,
      min_days: 30,
      min_blocks: 5,
      max_ci_half_width_r: 0.25,
      block_days: { Crypto: 14, Forex: 7, IDX: 90, US: 90 },
    },
    config: {
      levels_model: "atr",
      short_enabled: false,
      capital_idr: 20_000_000,
      cors_origins: ["http://127.0.0.1:4011"],
      write_auth_required: false,
    },
    ...over,
  };
}

export function runtimeReport(over: {
  backend?: Partial<RuntimeReport["backend"]>;
  frontend?: Partial<RuntimeReport["frontend"]>;
  proxy?: Partial<RuntimeReport["proxy"]>;
} = {}): RuntimeReport {
  return {
    checked_at: "2026-10-04T12:00:00.000Z",
    frontend: {
      build_id: "f2c7c41-d5b7fa6d163",
      built_at: "2026-10-04T11:00:00.000Z",
      git_commit: "f2c7c4108d68db31b6bbbcee6b3dc6b46ed64c15",
      git_branch: "codex/preserve-report-card-and-signal-log",
      git_dirty: true,
      git_dirty_files: 11,
      source_hash: "5b7fa6d1634c4171",
      source_files: 83,
      next_version: "16.2.4",
      node_env: "production",
      node_version: "v20.20.2",
      source_hash_now: "5b7fa6d1634c4171",
      source_matches_build: true,
      ...over.frontend,
    },
    backend: {
      status: "ok",
      upstream: "http://127.0.0.1:4010",
      latency_ms: 12,
      http_status: 200,
      error: null,
      runtime: backendRuntime(),
      health: null,
      contract: { policy: "weighted-v1", spec_hash: "f553ce3d", confidence_calibrated: false, source: "system/runtime" },
      ...over.backend,
    },
    proxy: { write_token_configured: false, ...over.proxy },
  };
}
