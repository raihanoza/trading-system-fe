import type {
  Signal,
  Trade,
  Stats,
  ChartData,
  ScanResponse,
  Watchlist,
  TierSpecsResponse,
} from "@/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Normalize signal from API — ensure gates are always arrays */
function normalizeSignal(s: Record<string, unknown>): Record<string, unknown> {
  return {
    ...s,
    gates_passed: Array.isArray(s.gates_passed) ? s.gates_passed : [],
    gates_failed: Array.isArray(s.gates_failed) ? s.gates_failed : [],
    // undefined dipertahankan untuk sinyal lama (belum punya kolom gates_optional)
    optional_passed: Array.isArray(s.optional_passed)
      ? s.optional_passed
      : undefined,
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

  // ── Signals ──────────────────────────────────────────────────────────────
  signals: {
    all: (limit = 20) => request<Signal[]>(`/signals?limit=${limit}`),
    byMarket: (market: string, limit = 20) =>
      request<Signal[]>(`/signals/${market}?limit=${limit}`),
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
  },

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
