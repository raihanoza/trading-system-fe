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

export interface ChartData {
  ticker: string;
  market: Market;
  interval: string;
  candles: Candle[];
  sr_levels: SRLevel[];
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
