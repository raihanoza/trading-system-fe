import type {
  Signal,
  Trade,
  Stats,
  ChartData,
  ScanResponse,
  OvernightScanResponse,
  Watchlist,
  TierSpecsResponse,
  DirectionsMeta,
  Heartbeat,
  ReportCard,
  GateLiftResponse,
  ReliabilityResponse,
  PortfolioRisk,
  GateCard,
  GateCardsResponse,
  GlossaryResponse,
  DailyReportCard,
  SignalLogResponse,
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

/**
 * Respons scan, dinormalisasi sama seperti `/signals`.
 *
 * Sampai 25 Agustus 2026 jalur scan memakai `request` polos. API mengirim
 * `gates_optional`, SignalCard membaca `optional_passed` — jadi tangga tier
 * diam-diam jatuh ke mode "sinyal lama" untuk SETIAP kartu hasil scan,
 * padahal datanya ada. `shadow_signals` ikut dinormalisasi karena kartunya
 * membaca field yang sama; kalau kuncinya absen (mis. forex di luar kill
 * zone) ia dibiarkan absen, bukan dipaksa jadi array kosong — "tidak
 * di-scan" dan "di-scan, nol kandidat" tidak boleh tampil sama.
 */
async function scanRequest(path: string): Promise<ScanResponse> {
  const r = await request<Record<string, unknown>>(path, { method: "POST" });
  return {
    ...r,
    signals: normalizeSignals(r.signals),
    ...(r.shadow_signals !== undefined
      ? { shadow_signals: normalizeSignals(r.shadow_signals) }
      : {}),
  } as unknown as ScanResponse;
}

// ── System ────────────────────────────────────────────────────────────────────
export const api = {
  health: () => request<{ status: string; version: string }>("/health"),
  stats: () => request<Stats>("/stats"),

  // Watchdog (Fase A) — "tidak ada sinyal" vs "scanner mati" harus bisa dibedakan.
  heartbeat: () => request<Heartbeat>("/system/heartbeat"),

  // Report card HARIAN — teks yang sama persis dengan yang dikirim job 07:00
  // ke WhatsApp. Dulu hanya bisa dilihat dengan menunggu jam itu; sejak
  // 2 Sep 2026 `core/report_card.py` melayani ketiga pintu dari satu fungsi.
  //
  // Sengaja TIDAK di-parse jadi objek: begitu FE mengurai lalu merangkainya
  // ulang, ia berhenti jadi laporan yang sama dan mulai jadi laporan kedua
  // yang bisa bergeser diam-diam dari yang dikirim ke WhatsApp.
  dailyReportCard: () => request<DailyReportCard>("/report-card"),

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

    // Log pencatatan otomatis — TIDAK lewat normalizeSignals: bentuknya bukan
    // Signal, melainkan jejak per-tahap (siapa menulis apa, kapan).
    log: (limit = 50, market?: string, includeShadow = true) => {
      const q = new URLSearchParams({
        limit: String(limit),
        include_shadow: String(includeShadow),
      });
      if (market) q.set("market", market);
      return request<SignalLogResponse>(`/signals/log?${q}`);
    },
  },

  // ── Scans ────────────────────────────────────────────────────────────────
  scan: {
    stockAll: () => scanRequest("/scan/stock"),
    stockIdx: () => scanRequest("/scan/stock/idx"),
    stockUs: () => scanRequest("/scan/stock/us"),
    // Overnight flip — BELUM TERUKUR (protokol 3.7). Bentuk respons beda
    // dari ScanResponse (kandidat+skor, bukan Signal dengan entry/SL/TP).
    stockOvernight: (submarket: "all" | "idx" | "us" = "all") =>
      request<OvernightScanResponse>(
        `/scan/stock/overnight?submarket=${submarket}`,
        { method: "POST" },
      ),
    crypto: () => scanRequest("/scan/crypto"),
    forex: () => scanRequest("/scan/forex"),
    ticker: (market: string, ticker: string) =>
      scanRequest(`/scan/${market}/${ticker}`),
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
    // Dipakai tab LONG/SHORT: tanpa ini "SHORT dimatikan" dan "SHORT menyala
    // tapi hari ini nihil kandidat" tampil sama saja di layar.
    directions: () => request<DirectionsMeta>("/meta/directions"),
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
    // `pnl_idr` OPSIONAL sejak 31 Agustus 2026 — server yang menghitungnya
    // dari `exit_price` (biaya + arah + KURS). Dulu wajib, dan diisi dari
    // `(exit − entry) × units` yang diketik pengguna: angka USD untuk
    // crypto/US yang disimpan ke kolom bernama `pnl_idr`, lalu dibandingkan
    // dengan ambang daily-stop bersatuan rupiah.
    close: (
      trade_id: number,
      exit_price: number,
      notes = "",
    ) =>
      request<{
        trade_id: number;
        outcome: string;
        pnl_idr: number;
        exit_price: number;
      }>(`/trades/${trade_id}/close`, {
        method: "PUT",
        body: JSON.stringify({ exit_price, notes }),
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

  // ── Edukasi (kelas D, D2/D3) ─────────────────────────────────────────────
  education: {
    gates: () => request<GateCardsResponse>("/education/gates"),
    gate: (name: string) =>
      request<GateCard>(`/education/gates/${encodeURIComponent(name)}`),
    glossary: () => request<GlossaryResponse>("/education/glossary"),
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
