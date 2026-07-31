// ── API Response Types ────────────────────────────────────────────────────────

export type Market = "stock" | "stock_idx" | "stock_us" | "crypto" | "forex";
export type Tier = "SNIPER" | "PRECISION" | "STANDARD" | "SCOUT" | "RADAR";
export type Action = "BUY" | "WATCH" | "SKIP";
export type Direction = "LONG" | "SHORT";
export type Outcome = "win" | "loss" | "breakeven" | "open";
export type Submarket = "IDX" | "US" | "Crypto" | "Forex";

export interface Signal {
  id: number;
  ticker: string;
  display: string;
  submarket: Submarket;
  market: Market;
  tier: Tier;
  action: Action;
  direction: Direction;
  entry: number;
  stop_loss: number;
  take_profit: number;
  rr_ratio: number;
  confidence: number;
  risk_idr: number;
  position_idr: number;
  gates_passed: string[];
  gates_failed: string[];
  optional_passed?: string[]; // Fase 3 — optional gates yang lolos (undefined utk sinyal lama)
  gates_all?: Record<string, boolean>; // Fase A — vektor gate PENUH, termasuk yang gagal & kandidat
  wyckoff: string | null;
  reason: string;
  created_at?: string;
  // Leverage fields (optional)
  leverage?: number;
  margin_required_idr?: number;
  liquidation_price?: number;

  // Sentiment (optional — di-attach saat scan)
  sentiment?: {
    score: number;
    label: string;
    flag: string;
    confidence: number;
    headline_count: number;
    bullish_count: number;
    bearish_count: number;
    neutral_count?: number;
    signal_conflict: boolean;
    conflict_severity: string;
    conflict_message: string;
    top_headlines?: { title: string; source: string; score: number }[];
  } | null;
}

export interface Trade {
  id: number;
  signal_id: number | null;
  ticker: string;
  market: Market;
  tier: Tier;
  entry: number;
  stop_loss: number;
  take_profit: number;
  exit_price: number | null;
  units: number;
  risk_idr: number;
  pnl_idr: number | null;
  outcome: Outcome;
  opened_at: string;
  closed_at: string | null;
  notes: string;
}

export interface Stats {
  win_rate_pct: number;
  total_trades: number;
  total_pnl_idr: number;
  open_positions: number;
  daily_pnl_idr: number;
}

export interface Candle {
  t: string; // timestamp ISO
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
}

export interface SRLevel {
  price: number;
  type: "support" | "resistance" | "both";
  strength: "weak" | "medium" | "strong";
  touches: number;
}

// ── Signal Evidence (Fase 2) ────────────────────────────────────────────────
export interface EvidenceFVG {
  top: number;
  bottom: number;
  direction: "bullish" | "bearish";
  formed_at: string;
  filled: boolean;
}

export interface EvidenceSweep {
  level: number;
  direction: "bullish_sweep" | "bearish_sweep";
  time: string;
  recovery_pct: number;
}

export interface EvidenceStructure {
  event: "BOS" | "CHoCH" | "MSS";
  direction: "bullish" | "bearish";
  level: number;
  time: string;
}

export type FreshnessZone =
  | "below_sl"
  | "at_risk"
  | "near_entry"
  | "in_progress"
  | "past_tp";
export type FreshnessVerdict =
  | "actionable"
  | "chasing"
  | "invalidated"
  | "resolved";

export interface Freshness {
  current_price: number;
  entry: number;
  stop_loss: number;
  take_profit: number;
  direction: "long" | "short";
  dist_to_entry_pct: number;
  zone: FreshnessZone;
  fvg_unfilled: boolean;
  outcome: string;
  verdict: FreshnessVerdict;
}

export interface Evidence {
  fvgs: EvidenceFVG[];
  sweeps: EvidenceSweep[];
  structure: EvidenceStructure[];
  freshness: Freshness | null;
}

export interface ChartData {
  ticker: string;
  market: Market;
  interval: string;
  candles: Candle[];
  sr_levels: SRLevel[];
  evidence?: Evidence;
}

// ── Tier specs (Fase 3 — /meta/tiers) ───────────────────────────────────────
export interface TierMeta {
  tier: string;
  mandatory: string[];
  optional: string[];
  min_opt: number;
  min_rr: number;
}

export interface TierSpecsResponse {
  spec_hash: string;
  tiers: TierMeta[];
}

// ── Watchdog / heartbeat (Fase A, 4.1) ───────────────────────────────────────
// Sistem pernah diam dua bulan tanpa ada yang tahu: "tidak ada setup bagus" dan
// "scanner mati" terlihat identik dari luar. Chip di header memisahkannya.

export type HeartbeatStatus = "ok" | "stale" | "never";

export interface HeartbeatMarket {
  market: string;
  status: HeartbeatStatus;
  last_success_at: string | null;
  hours_ago: number | null;
  tickers: number;
  signals: number;
  last_error: { at: string; market: string; message: string } | null;
}

export interface Heartbeat {
  now: string;
  stale: boolean;
  stale_threshold_hours: number;
  markets: HeartbeatMarket[];
  message: string;
}

// ── Report card kalibrasi (4.2) + pengukuran Fase C ──────────────────────────

export interface SampleSummary {
  total: number;
  decided: number;
  wins: number;
  losses: number;
  expired: number;
  win_rate: number | null;
  ci_low: number | null;
  ci_high: number | null;
  expectancy_r: number | null;
  total_r: number;
  enough_sample: boolean;
}

/**
 * Empat vonis terakhir sengaja dipisah dari "sampel kurang". Semuanya dulu
 * dilaporkan sebagai "sampel kurang", padahal hanya "sampel kurang" yang
 * tertolong oleh data tambahan — untuk sisanya cabang OFF-nya tidak ada
 * secara konstruksi, jadi ditunggu berapa lama pun tidak akan muncul.
 */
export type GateVerdict =
  | "positif"
  | "negatif"
  | "tidak konklusif"
  | "sampel kurang"
  | "tak ada di vektor"
  | "tak terukur (konstan)"
  | "tak terukur (tersaring tier)"
  | "tak terukur (satu nilai)";

export interface GateLiftRow {
  gate: string;
  n_on: number;
  n_off: number;
  /** Seluruh baris per cabang (termasuk expired) — 0 berarti cabangnya tak ada. */
  rows_on: number;
  rows_off: number;
  win_rate_on: number | null;
  win_rate_off: number | null;
  ci_on: [number | null, number | null];
  ci_off: [number | null, number | null];
  expectancy_on: number | null;
  expectancy_off: number | null;
  lift_pp: number | null;
  verdict: GateVerdict;
  /** Apakah gate bernilai True DAN False saat dihitung. null = tak diketahui. */
  varies_at_source: boolean | null;
  /** false = lift-nya tak akan muncul berapa pun data ditambah. */
  measurable: boolean;
  /** Tindak lanjut yang benar untuk vonis ini. */
  remedy: string | null;
}

export interface ReliabilityBucket {
  bucket: string;
  confidence_mid: number;
  n: number;
  win_rate: number | null;
  ci_low: number | null;
  ci_high: number | null;
  gap_pp: number | null;
  enough_sample: boolean;
}

export interface TierHitRate extends SampleSummary {
  tier: Tier;
}

export interface BacktestRunSummary {
  id: number;
  label: string;
  mode: string;
  market: string;
  trades: number;
  win_rate: number | null;
  expectancy_r: number | null;
  created_at: string;
}

export interface ReportCard {
  market: string;
  trust_statement: string;
  overall: SampleSummary;
  by_tier: TierHitRate[];
  reliability: ReliabilityBucket[];
  calibration_error_pp: number | null;
  gate_lift: GateLiftRow[];
  backtest_runs: BacktestRunSummary[];
}

export interface GateLiftResponse {
  market: string;
  sample: SampleSummary;
  min_sample: number;
  gates: GateLiftRow[];
  caveat: string | null;
}

export interface ReliabilityResponse {
  market: string;
  sample: SampleSummary;
  curve: ReliabilityBucket[];
  calibration_error_pp: number | null;
  note: string;
}

// ── Risiko portofolio (Fase E, 4.5) ──────────────────────────────────────────

export interface PortfolioRisk {
  capital_idr: number;
  open_positions: number;
  total_risk_idr: number;
  total_risk_pct: number;
  risk_budget_idr: number;
  headroom_idr: number;
  over_budget: boolean;
  by_market: {
    market: string;
    positions: number;
    risk_idr: number;
    share_pct: number;
    tickers: string[];
  }[];
  long_positions: number;
  short_positions: number;
  warnings: string[];
  sector_note: string;
  projection?: {
    ticker: string;
    added_risk_idr: number;
    total_risk_after: number;
    risk_pct_after: number;
    fits_budget: boolean;
    blockers: string[];
    verdict: string;
  };
}

export interface ScanResponse {
  scanned: string;
  signals_found: number;
  signals: Signal[];
  message: string;
  // Forex specific
  kill_zone?: boolean;
  session?: string;
  wib_time?: string;
  next?: string;
  // Stock specific
  idx_count?: number;
  us_count?: number;
}

export interface Watchlist {
  stock_idx: { label: string; count: number; tickers: string[] };
  stock_us: { label: string; count: number; tickers: string[] };
  crypto: { label: string; count: number; tickers: string[] };
  forex: { label: string; count: number; tickers: string[] };
}

// ── UI Types ──────────────────────────────────────────────────────────────────

export interface TierConfig {
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
}

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  SNIPER: {
    label: "Sniper",
    emoji: "🎯",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10 border-emerald-400/20",
  },
  PRECISION: {
    label: "Precision",
    emoji: "🔵",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10 border-blue-400/20",
  },
  STANDARD: {
    label: "Standard",
    emoji: "🟣",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10 border-purple-400/20",
  },
  SCOUT: {
    label: "Scout",
    emoji: "🟡",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10 border-yellow-400/20",
  },
  RADAR: {
    label: "Radar",
    emoji: "🔴",
    color: "text-red-400",
    bgColor: "bg-red-400/10 border-red-400/20",
  },
};

export const MARKET_CONFIG = {
  stock_idx: { label: "IDX", emoji: "🇮🇩", color: "text-orange-400" },
  stock_us: { label: "US", emoji: "🇺🇸", color: "text-blue-400" },
  stock: { label: "Stock", emoji: "📈", color: "text-blue-400" },
  crypto: { label: "Crypto", emoji: "🔷", color: "text-cyan-400" },
  forex: { label: "Forex", emoji: "💱", color: "text-violet-400" },
};
