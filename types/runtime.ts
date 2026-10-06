/**
 * Identitas runtime — jawaban untuk "versi mana yang sedang dilihat pengguna?".
 *
 * Audit 4 Okt 2026 menemukan build frontend tertinggal empat commit dari
 * sumbernya tanpa tanda apa pun di layar. Tipe-tipe ini dipakai chip header
 * dan halaman Sistem supaya keadaan itu terlihat, bukan disimpulkan.
 */

/** `GET /system/runtime` backend (core/runtime_identity.py). */
export interface BackendRuntime {
  service: string;
  app_version: string;
  process: { started_at: string; pid: number; python: string };
  code: {
    git_at_start: { branch: string | null; commit: string | null } | null;
    fingerprint_at_start: { sha256_16: string; files: number };
    fingerprint_now: { sha256_16: string | null; files: number; error?: string };
    /** null = sidik saat ini tidak bisa dihitung. */
    changed_since_start: boolean | null;
    fingerprint_scope: string[];
  };
  mode: "paper" | "live";
  paper_trade: boolean;
  execution_note: string;
  tier_contract: {
    policy: string | null;
    spec_hash: string;
    confidence_calibrated: boolean;
    score_is_probability: false;
  };
  /** Lantai vonis forward per pasar (konstanta backend core/gate_lift.py). */
  evaluation_floor: {
    min_terminal: number;
    min_days: number;
    min_blocks: number;
    max_ci_half_width_r: number;
    block_days: Record<string, number>;
  };
  config: {
    levels_model: string;
    short_enabled: boolean;
    capital_idr: number;
    cors_origins: string[];
    write_auth_required: boolean;
  };
}

/** Identitas build frontend, dibakukan saat `next build` (lib/build-identity.mjs). */
export interface FrontendBuild {
  build_id: string;
  built_at: string;
  git_commit: string | null;
  git_branch: string | null;
  /** null = git tidak tersedia saat build. */
  git_dirty: boolean | null;
  git_dirty_files: number | null;
  source_hash: string;
  source_files: number;
  next_version: string;
}

export type BackendStatus =
  | "ok" // /system/runtime menjawab
  | "legacy" // /health menjawab, /system/runtime 404 (backend belum di-restart)
  | "error" // backend menjawab dengan galat
  | "unreachable"; // tidak ada jawaban

/** `GET /api/runtime` — route handler frontend. */
export interface RuntimeReport {
  checked_at: string;
  frontend: FrontendBuild & {
    node_env: string;
    node_version: string;
    /** Sidik sumber di disk SAAT INI; dibandingkan dengan `source_hash` build. */
    source_hash_now: string | null;
    /** false = build yang disajikan BUKAN hasil sumber yang ada di disk. */
    source_matches_build: boolean | null;
  };
  backend: {
    status: BackendStatus;
    upstream: string;
    latency_ms: number | null;
    http_status: number | null;
    error: string | null;
    runtime: BackendRuntime | null;
    health: { status?: string; version?: string; time?: string } | null;
    /**
     * Kontrak tier yang dilayani backend. Dari `/system/runtime` bila ada;
     * untuk backend lama dari `/meta/tiers` (endpoint yang sudah lama ada),
     * supaya nama kontrak tetap terlihat sebelum backend di-restart.
     */
    contract: {
      policy: string | null;
      spec_hash: string;
      confidence_calibrated: boolean;
      source: "system/runtime" | "meta/tiers";
    } | null;
  };
  proxy: {
    /** Hanya ada/tidaknya. Nilai token tidak pernah keluar dari server. */
    write_token_configured: boolean;
  };
}
