// ── API Response Types ────────────────────────────────────────────────────────

export type Market = "stock" | "stock_idx" | "stock_us" | "crypto" | "forex";
export type Tier = "SNIPER" | "PRECISION" | "STANDARD" | "SCOUT" | "RADAR";
export type Action = "BUY" | "WATCH" | "SKIP";
export type Direction = "LONG" | "SHORT";
export type Outcome = "win" | "loss" | "breakeven" | "open";

/**
 * Siklus hidup sinyal (4.3, backend `core/signal_lifecycle.py`):
 * waiting_entry -> active -> hit_tp | hit_sl | expired | invalidated.
 *
 * Sinyal yang MASIH hidup hanya dua yang pertama; sisanya sudah selesai dan
 * tidak boleh ditawarkan sebagai setup yang bisa diambil.
 */
export type SignalStatus =
  | "waiting_entry"
  | "active"
  | "hit_tp"
  | "hit_sl"
  | "expired"
  | "invalidated";

export const SIGNAL_HIDUP: readonly SignalStatus[] = [
  "waiting_entry",
  "active",
] as const;
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
  // Perkiraan peluang menang TERKALIBRASI (backend 29 Agu 2026). Karena belum
  // ada kombinasi gate yang terbukti punya daya pisah, nilainya SAMA untuk
  // semua sinyal di satu pasar — jangan dipakai mengurutkan atau membandingkan
  // antar-sinyal. Lihat core/confidence.py di repo backend.
  confidence: number;
  // Proporsi bukti OPSIONAL yang lolos di tier ini (0-100). Inilah yang
  // bervariasi antar-sinyal, dan inilah yang ditampilkan sebagai badge.
  // undefined/null = sinyal DIBUAT SEBELUM 29 Agu 2026; sengaja tidak
  // di-backfill karena `confidence` lama bukan besaran yang sama.
  evidence_pct?: number | null;
  risk_idr: number;
  position_idr: number;
  gates_passed: string[];
  gates_failed: string[];
  optional_passed?: string[]; // Fase 3 — optional gates yang lolos (undefined utk sinyal lama)
  gates_all?: Record<string, boolean>; // Fase A — vektor gate PENUH, termasuk yang gagal & kandidat
  wyckoff: string | null;
  reason: string;
  created_at?: string;
  // Diisi `/signals` (baris DB), TIDAK diisi respons scan — sinyal yang baru
  // terbit belum punya riwayat siklus hidup. `undefined` karena itu berarti
  // "baru saja terbit", bukan "statusnya tidak diketahui".
  status?: SignalStatus;
  outcome?: "pending" | "win" | "loss" | "expired" | string;
  // Apakah baris ini masih dijangkau pelacak siklus hidup (backend
  // `LIFECYCLE_WINDOW_DAYS`). `false` = `status`-nya BEKU, bukan kabar terbaru:
  // pelacak hanya mengambil sinyal dalam 30 hari terakhir, jadi yang lebih tua
  // menetap di `active` selamanya. Dihitung server-side supaya jendelanya tidak
  // perlu disalin ke UI.
  lifecycle_tracked?: boolean;
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

  // D5 — skenario invalidasi PROSPEKTIF. Dilampirkan `/signals` saat penyajian
  // (tidak disimpan), jadi selalu memakai aturan lifecycle yang berlaku
  // sekarang — bukan aturan saat sinyalnya dulu terbit.
  invalidation?: {
    syarat: {
      kode: string;
      kalimat: string;
      kapan: "sebelum entry" | "setelah entry" | string;
    }[];
    entry_ttl: number;
    max_bars: number;
    satuan_bar: string;
    ringkas: string;
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
  // Gate yang BENAR-BENAR menentukan tier, vs gate KANDIDAT (protokol 3.7)
  // yang dihitung dan disimpan tapi tidak menentukan apa pun. Dipisahkan di
  // backend supaya FE tidak menyalin daftarnya: begitu sebuah kandidat
  // dipromosikan ke tangga, tampilan ikut berubah tanpa disentuh.
  // `undefined` = backend lama yang belum menerbitkannya.
  scored?: string[];
  candidates?: string[];
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
  /** Run tersimpan yang sengaja TIDAK dihitung, beserta alasannya.
   *  Opsional: backend lama tidak mengirimnya. */
  backtest_runs_ditolak?: (BacktestRunSummary & { reason: string })[];
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

// ── Modul edukasi (kelas D, D2/D3) ───────────────────────────────────────────

/** Konteks yang WAJIB menyertai setiap angka terukur (aturan §7.6). */
export interface MeasurementContext {
  market: string;
  mode: string;
  levels_model: string;
  years: number;
  interval: string;
  tickers: number;
  data_fingerprint: string | null;
  window_start: string | null;
  window_end: string | null;
  run_id: number;
  run_label: string;
}

export interface GateMeasurement {
  lift_pp: number | null;
  verdict: string;
  /** Terisi bila vonis tersimpan usang dan dikoreksi saat dibaca. */
  verdict_correction: string | null;
  measurable: boolean | null;
  remedy: string | null;
  n_on: number | null;
  n_off: number | null;
  win_rate_on: number | null;
  win_rate_off: number | null;
  ci_on: [number | null, number | null] | null;
  ci_off: [number | null, number | null] | null;
  context: MeasurementContext;
}

export interface GateCard {
  gate: string;
  content: {
    judul: string;
    definisi: string;
    cara_dihitung: string;
    cara_membaca_di_chart: string;
    salah_kaprah: string;
    catatan_sistem: string;
  } | null;
  structure: {
    mandatory_in: string[];
    optional_in: string[];
    is_candidate: boolean;
    is_absolute_veto: boolean;
    always_mandatory: boolean;
    scores_tier: boolean;
    role_summary: string;
  };
  /** null = belum pernah diukur (BUKAN "diukur, hasilnya nol"). */
  measured: GateMeasurement[] | null;
  teaching_note: string;
  redundancy?: {
    with: string;
    agreement: number | null;
    phi: number | null;
    verdict: string;
    informative: boolean;
    context: MeasurementContext;
  }[];
}

export interface GateCardsResponse {
  gates: GateCard[];
  sources: {
    run_id: number;
    label: string;
    market: string;
    mode: string;
    trades: number;
    win_rate: number | null;
    expectancy_r: number | null;
    data_fingerprint: string | null;
    levels_model: string;
  }[];
  excluded_runs: { run_id: number; label: string; reason: string }[];
  gates_without_content: string[];
  disclaimer: string;
}

export interface GlossaryResponse {
  terms: { istilah: string; ringkas: string; isi: string }[];
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
  /** C1/C4 — eksposur per grup korelasi (sektor / crypto / mata uang forex). */
  by_correlation_group: {
    group: string;
    label: string;
    direction: string;
    positions: number;
    risk_idr: number;
    tickers: string[];
  }[];
  group_budget_idr: number;
  group_max_risk_pct: number;
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
    /** Grup korelasi yang beririsan dengan sinyal ini, searah. */
    correlation_groups: {
      group: string;
      label: string;
      existing_tickers: string[];
      risk_idr_after: number;
      over_group_budget: boolean;
    }[];
    blockers: string[];
    verdict: string;
  };
}

/**
 * Baris yang TIDAK diterbitkan tapi tetap harus TERLIHAT (E1, backend 24 Agu
 * 2026). Tiga asal-usul, dibedakan lewat `classifyShadow()`:
 *
 *   • `[NO-LEVELS]` — gate terhitung penuh, tapi entry/SL/TP tak terbentuk
 *     karena level S/R timpang. `stop_loss`/`take_profit` **0.0 dan bukan
 *     harga** — jangan pernah ditampilkan sebagai level.
 *   • `[SHADOW]`    — gugur di tangga tier.
 *   • `[DUPLIKAT]`  — sinyal sungguhan, ditahan karena setup sama masih aktif.
 *
 * `id` null: tidak satu pun dari ketiganya punya baris di DB pada scan ini.
 */
export interface ShadowSignal extends Omit<Signal, "id"> {
  id: number | null;
  duplicate?: boolean;
  // Diblokir karena ada sinyal/posisi HIDUP berlawanan arah di instrumen yang
  // sama (risiko 5.1 jalur SHORT). Sebabnya BEDA dari duplikat dan beda dari
  // gugur di tangga tier: setup ini justru LOLOS tangga tier, yang menolaknya
  // adalah aturan portofolio. Tanpa flag ini kartunya tampil sebagai "gugur di
  // tangga tier" — keliru, dan menyembunyikan satu-satunya alasan sebenarnya.
  blocked_opposite?: boolean;
}

/** `/meta/directions` — arah mana yang BENAR-BENAR dipindai backend. */
export interface DirectionsMeta {
  // Sakelar konfigurasi `SHORT_ENABLED`. Mati sejak protokol jalur SHORT gagal
  // kriteria §4.4 (28 Agu 2026).
  short_enabled: boolean;
  // Batas MEKANIS, bukan konfigurasi: IDX/US tidak bisa short walau sakelarnya
  // dinyalakan.
  short_allowed_markets: string[];
}

export interface ScanResponse {
  scanned: string;
  signals_found: number;
  signals: Signal[];
  message: string;
  // E1 — kandidat yang tidak diterbitkan. Dipisah dari `signals` dengan
  // sengaja: menggabungkannya akan membuat `signals_found` berhenti berarti
  // "yang diterbitkan". Absen di respons yang gugur sebelum scan jalan
  // (mis. forex di luar kill zone).
  shadow_signals?: ShadowSignal[];
  shadow_count?: number;
  // Forex specific
  kill_zone?: boolean;
  session?: string;
  wib_time?: string;
  next?: string;
  // Kenapa engine BERHENTI sebelum menganalisis apa pun (pasar tutup akhir
  // pekan / rollover / menjelang tutup pekan), atau null kalau tidak diblokir.
  //
  // BEDA dari `kill_zone`, dan bedanya penting: `kill_zone` cuma soal JAM
  // (London 14–17, NY 20:30–23 WIB) dan tidak tahu apa-apa soal HARI. Sabtu
  // 21:43 WIB memberi `kill_zone: true` sementara pasarnya tutup. Tanpa
  // `blocked`, hasil kosong terbaca sebagai "nol setup lolos" — padahal nol
  // pair pernah diambil.
  blocked?: string | null;
  // `false` = tidak satu pun pair sempat dianalisis.
  analyzed?: boolean;
  // Stock specific
  idx_count?: number;
  us_count?: number;
}

// Overnight flip — strategi kedua modul stock, BELUM TERUKUR (protokol 3.7).
// Bentuk beda dari Signal: bukan entry/SL/TP dengan target harga, tapi
// kandidat terurut skor closing-strength. Lihat
// docs/plans/2026-08-24-overnight-flip-stock-design.md di repo backend.
export interface OvernightCandidate {
  ticker: string;
  submarket: "IDX" | "US";
  score: number; // 0-3
  clv: number; // 0-1, Close Location Value
  above_vwap: boolean;
  vwap: number;
  late_volume_share: number; // 0-1
  price: number;
  duplicate: boolean; // true = kandidat sama masih aktif, tidak disimpan ulang
  reason: string;
}

export interface OvernightScanResponse {
  scanned: string;
  measured: false; // selalu false — belum ada strategi yang lolos protokol 3.7
  note: string;
  candidates_found: number;
  candidates: OvernightCandidate[];
  message: string;
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
