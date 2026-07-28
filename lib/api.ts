import type {
  Signal,
  Trade,
  Stats,
  ChartData,
  ScanResponse,
  Watchlist,
  TierSpecsResponse,
  Heartbeat,
  ReportCard,
  GateLiftResponse,
  ReliabilityResponse,
  PortfolioRisk,
} from "@/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Normalize signal from API — ensure gates are always arrays.
 *
 * Dua bentuk respons hidup berdampingan: endpoint scan memakai kunci hasil
 * serialisasi (`gates_optional`), sedangkan `/signals` mengembalikan baris DB
 * mentah yang kunci kolomnya juga `gates_optional`. FE memakai nama
 * `optional_passed`, jadi pemetaan dilakukan di satu tempat ini.
 */
function normalizeSignal(s: Record<string, unknown>): Record<string, unknown> {
  const optional = Array.isArray(s.optional_passed)
    ? s.optional_passed
    : Array.isArray(s.gates_optional)
      ? s.gates_optional
      : undefined;

  return {
    ...s,
    gates_passed: Array.isArray(s.gates_passed) ? s.gates_passed : [],
    gates_failed: Array.isArray(s.gates_failed) ? s.gates_failed : [],
    // undefined dipertahankan untuk sinyal lama (belum punya kolom gates_optional)
    optional_passed: optional,
    // Vektor gate penuh (Fase A) — {nama: bool}, bukan list.
    gates_all:
      s.gates_all && typeof s.gates_all === "object" ? s.gates_all : undefined,
  };
}

function normalizeSignals(data: unknown): unknown {
  if (Array.isArray(data))
    return data.map((s) => normalizeSignal(s as Record<string, unknown>));
  return data;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }
  return res.json();
}

// ── System ────────────────────────────────────────────────────────────────────
export const api = {
  health: () => request<{ status: string; version: string }>("/health"),
  stats: () => request<Stats>("/stats"),

  // Watchdog (Fase A) — "tidak ada sinyal" vs "scanner mati" harus bisa dibedakan.
  heartbeat: () => request<Heartbeat>("/system/heartbeat"),

  // ── Signals ──────────────────────────────────────────────────────────────
  signals: {
    // normalizeSignals dipakai di sini — tanpa itu `optional_passed` selalu
    // undefined dan tangga tier di SignalCard diam-diam jatuh ke mode "sinyal lama".
    all: (limit = 20) =>
      request<unknown>(`/signals?limit=${limit}`).then(
        (d) => normalizeSignals(d) as Signal[],
      ),
    byMarket: (market: string, limit = 20) =>
      request<unknown>(`/signals/${market}?limit=${limit}`).then(
        (d) => normalizeSignals(d) as Signal[],
      ),
  },

  // ── Scans ────────────────────────────────────────────────────────────────
  scan: {
    stockAll: () => request<ScanResponse>("/scan/stock", { method: "POST" }),
    stockIdx: () =>
      request<ScanResponse>("/scan/stock/idx", { method: "POST" }),
    stockUs: () => request<ScanResponse>("/scan/stock/us", { method: "POST" }),
    crypto: () => request<ScanResponse>("/scan/crypto", { method: "POST" }),
    forex: () => request<ScanResponse>("/scan/forex", { method: "POST" }),
    ticker: (market: string, ticker: string) =>
      request<ScanResponse>(`/scan/${market}/${ticker}`, { method: "POST" }),
  },

  // ── Charts ───────────────────────────────────────────────────────────────
  // signalId opsional → respons menyertakan evidence.freshness untuk sinyal itu.
  chart: (market: string, ticker: string, interval = "1d", signalId?: number) =>
    request<ChartData>(
      `/charts/${market}/${ticker}?interval=${interval}` +
        (signalId != null ? `&signal_id=${signalId}` : ""),
    ),

  // ── Meta ─────────────────────────────────────────────────────────────────
  meta: {
    tiers: () => request<TierSpecsResponse>("/meta/tiers"),
  },

  // ── Watchlist ────────────────────────────────────────────────────────────
  watchlist: () => request<Watchlist>("/watchlist"),

  // ── Trades ───────────────────────────────────────────────────────────────
  trades: {
    list: () => request<Trade[]>("/trades"),
    execute: (signal_id: number, units: number, notes = "") =>
      request("/trades/execute", {
        method: "POST",
        body: JSON.stringify({ signal_id, units, notes }),
      }),
    close: (
      trade_id: number,
      exit_price: number,
      pnl_idr: number,
      notes = "",
    ) =>
      request(`/trades/${trade_id}/close`, {
        method: "PUT",
        body: JSON.stringify({ exit_price, pnl_idr, notes }),
      }),
  },

  // ── Analytics ────────────────────────────────────────────────────────────
  analytics: {
    summary: () => request("/analytics/summary"),
    pnlTimeline: () => request("/analytics/pnl-timeline"),
    byTier: () => request("/analytics/by-tier"),
    byMarket: () => request("/analytics/by-market"),
    gateAccuracy: () => request("/analytics/gate-accuracy"),
    signalAccuracy: () => request("/analytics/signal-accuracy"),
    monthly: () => request("/analytics/monthly"),

    // ── Pengukuran (Fase C) + report card kalibrasi (4.2) ─────────────────
    reportCard: (market = "all") =>
      request<ReportCard>(`/analytics/report-card?market=${market}`),
    gateLift: (market = "all") =>
      request<GateLiftResponse>(`/analytics/gate-lift?market=${market}`),
    reliability: (market = "all") =>
      request<ReliabilityResponse>(`/analytics/reliability?market=${market}`),
  },

  // ── Portofolio (Fase E, 4.5) ─────────────────────────────────────────────
  portfolioRisk: (signalId?: number) =>
    request<PortfolioRisk>(
      `/portfolio/risk${signalId != null ? `?signal_id=${signalId}` : ""}`,
    ),

  // ── Debug ────────────────────────────────────────────────────────────────
  debug: (market: string, ticker: string) =>
    request(`/debug/${market}/${ticker}`),
};

// Tier specs statis per-deploy → fetch sekali, dibagi ke semua SignalCard.
let _tierSpecsPromise: Promise<TierSpecsResponse> | null = null;
export function getTierSpecs(): Promise<TierSpecsResponse> {
  if (!_tierSpecsPromise) _tierSpecsPromise = api.meta.tiers();
  return _tierSpecsPromise;
}
