"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Newspaper,
  Radio,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { ApiErrorNotice } from "@/components/system/StateNotice";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Headline {
  title: string;
  source: string;
  url: string;
  score: number;
  sentiment: string;
  relevance: number;
  keywords: string[];
}

interface SentimentData {
  ticker: string;
  market: string;
  score: number;
  label: string;
  flag: string;
  confidence: number;
  headline_count: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  signal_conflict: boolean;
  conflict_severity: string;
  conflict_message: string;
  sources_checked: string[];
  fetched_at: string | null;
  headlines: Headline[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const MARKET_OPTIONS = [
  {
    value: "crypto",
    label: "Crypto",
    emoji: "🔷",
    placeholder: "BTCUSDT, ETHUSDT, SOLUSDT",
  },
  {
    value: "forex",
    label: "Forex",
    emoji: "💱",
    placeholder: "EUR_USD, GBP_USD, USD_JPY",
  },
  {
    value: "stock_us",
    label: "US Stock",
    emoji: "🇺🇸",
    placeholder: "AAPL, NVDA, GOOGL, TSLA",
  },
  {
    value: "stock_idx",
    label: "IDX Stock",
    emoji: "🇮🇩",
    placeholder: "BBCA.JK, TLKM.JK, BBRI.JK",
  },
];

const QUICK_TICKERS: Record<string, string[]> = {
  crypto: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"],
  forex: ["EUR_USD", "GBP_USD", "USD_JPY", "AUD_USD", "USD_CHF"],
  stock_us: ["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL"],
  stock_idx: ["BBCA.JK", "TLKM.JK", "BBRI.JK", "ASII.JK", "BMRI.JK"],
};

const SENTIMENT_COLORS: Record<
  string,
  { bg: string; text: string; bar: string }
> = {
  STRONG_BULLISH: {
    bg: "bg-emerald-500/10 border-emerald-500/30",
    text: "text-emerald-400",
    bar: "bg-emerald-500",
  },
  BULLISH: {
    bg: "bg-green-500/10 border-green-500/25",
    text: "text-green-400",
    bar: "bg-green-500",
  },
  NEUTRAL: {
    bg: "bg-secondary border-border",
    text: "text-muted-foreground",
    bar: "bg-secondary-foreground/30",
  },
  BEARISH: {
    bg: "bg-red-500/10 border-red-500/25",
    text: "text-red-400",
    bar: "bg-red-500",
  },
  STRONG_BEARISH: {
    bg: "bg-red-600/15 border-red-600/30",
    text: "text-red-500",
    bar: "bg-red-600",
  },
};

const HEADLINE_SENTIMENT_COLOR: Record<string, string> = {
  STRONG_BULLISH: "text-emerald-400",
  BULLISH: "text-green-400",
  NEUTRAL: "text-muted-foreground",
  BEARISH: "text-red-400",
  STRONG_BEARISH: "text-red-500",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SentimentMeter({ score }: { score: number }) {
  // score: -1.0 to +1.0, map to 0-100%
  const pct = ((score + 1) / 2) * 100;
  const color =
    score >= 0.15
      ? "bg-emerald-500"
      : score <= -0.15
        ? "bg-red-500"
        : "bg-yellow-500";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Bearish</span>
        <span>Neutral</span>
        <span>Bullish</span>
      </div>
      <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/80 z-10" />
        {/* Score indicator */}
        <div
          className={cn(
            "absolute top-0.5 bottom-0.5 w-4 rounded-full transition-all duration-500",
            color,
          )}
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
      <div
        className="text-center font-mono text-xs font-bold"
        style={{
          color:
            score >= 0.15 ? "#34d399" : score <= -0.15 ? "#f87171" : "#facc15",
        }}
      >
        {score > 0 ? "+" : ""}
        {score.toFixed(3)}
      </div>
    </div>
  );
}

function ConflictBanner({
  severity,
  message,
}: {
  severity: string;
  message: string;
}) {
  const styles = {
    severe: "bg-red-500/15 border-red-500/40 text-red-400",
    moderate: "bg-orange-500/15 border-orange-500/40 text-orange-400",
    minor: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
  };
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 rounded-xl border",
        styles[severity as keyof typeof styles] ?? styles.minor,
      )}
    >
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <p className="text-xs">{message}</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SentimentContent() {
  const [market, setMarket] = useState("crypto");
  const [ticker, setTicker] = useState("");
  const [signalAction, setSignalAction] = useState("");
  const [signalTier, setSignalTier] = useState("");
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const analyze = useCallback(
    async (t?: string) => {
      const target = (t ?? ticker).trim().toUpperCase();
      if (!target) return;

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (signalAction) params.set("signal_action", signalAction);
        if (signalTier) params.set("signal_tier", signalTier);

        const path = `/sentiment/${encodeURIComponent(market)}/${encodeURIComponent(target)}${params.toString() ? "?" + params : ""}`;
        setData(await apiGet<SentimentData>(path));
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [market, ticker, signalAction, signalTier],
  );

  const colors = data
    ? (SENTIMENT_COLORS[data.label] ?? SENTIMENT_COLORS.NEUTRAL)
    : null;
  const mConfig = MARKET_OPTIONS.find((m) => m.value === market);

  return (
    <div className="space-y-5">
      {/* Search Panel */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-muted-foreground" />
          News Sentiment Analyzer
        </h2>

        {/* Market selector */}
        <div className="flex gap-1.5 flex-wrap">
          {MARKET_OPTIONS.map((m) => (
            <button
              key={m.value}
              onClick={() => {
                setMarket(m.value);
                setTicker("");
                setData(null);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                market === m.value
                  ? "bg-primary/15 text-primary border-primary/25"
                  : "text-muted-foreground border-border hover:text-foreground",
              )}
            >
              {m.emoji} {m.label}
            </button>
          ))}
        </div>

        {/* Ticker input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyze()}
              placeholder={mConfig?.placeholder}
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-border bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>
          <button
            onClick={() => analyze()}
            disabled={loading || !ticker.trim()}
            className="px-5 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all flex items-center gap-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Radio className="w-4 h-4" />
            )}
            {loading ? "Scanning..." : "Analyze"}
          </button>
        </div>

        {/* Quick tickers */}
        <div className="flex flex-wrap gap-1.5">
          {(QUICK_TICKERS[market] ?? []).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTicker(t);
                analyze(t);
              }}
              className="px-2.5 py-1 text-[11px] rounded-md bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all font-mono"
            >
              {t}
            </button>
          ))}
        </div>

        {/* Optional: signal conflict check */}
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform inline-block">
              ▶
            </span>
            Conflict Detection (optional — masukkan sinyal teknikal untuk cek
            konflik)
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">
                Signal Action
              </label>
              <select
                value={signalAction}
                onChange={(e) => setSignalAction(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-secondary text-foreground focus:outline-none"
              >
                <option value="">None</option>
                <option value="BUY">BUY</option>
                <option value="WATCH">WATCH</option>
                <option value="SELL">SELL</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">
                Signal Tier
              </label>
              <select
                value={signalTier}
                onChange={(e) => setSignalTier(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-secondary text-foreground focus:outline-none"
              >
                <option value="">None</option>
                {["SNIPER", "PRECISION", "STANDARD", "SCOUT", "RADAR"].map(
                  (t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ),
                )}
              </select>
            </div>
            {/* Kolom "NewsAPI Key" dicabut 4 Okt 2026: kunci yang diketik di
                browser dikirim sebagai query string (`?newsapi_key=`) dan
                ikut tercatat di log akses API. Kunci pihak ketiga harus
                tinggal di konfigurasi server, bukan di browser. */}
          </div>
        </details>
      </div>

      {/* Error */}
      {error != null && <ApiErrorNotice error={error} action="memuat sentimen" />}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl border border-border shimmer"
            />
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && data && colors && (
        <div className="space-y-4 animate-fade-in">
          {/* Conflict banner — prominent */}
          {data.signal_conflict && data.conflict_message && (
            <ConflictBanner
              severity={data.conflict_severity}
              message={data.conflict_message}
            />
          )}

          {/* Main sentiment card */}
          <div className={cn("rounded-xl border p-5 space-y-4", colors.bg)}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{data.flag}</span>
                  <div>
                    <h3 className="text-lg font-bold font-mono text-foreground">
                      {data.ticker}
                    </h3>
                    <p className="text-xs text-muted-foreground capitalize">
                      {data.market.replace("_", " ")}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className={cn("text-2xl font-bold", colors.text)}>
                  {data.label.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(data.confidence * 100)}% confidence
                </p>
              </div>
            </div>

            {/* Meter */}
            <SentimentMeter score={data.score} />

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Bullish",
                  value: data.bullish_count,
                  color: "text-emerald-400",
                },
                {
                  label: "Neutral",
                  value: data.neutral_count,
                  color: "text-muted-foreground",
                },
                {
                  label: "Bearish",
                  value: data.bearish_count,
                  color: "text-red-400",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg bg-background/30 p-2.5 text-center"
                >
                  <p className={cn("text-xl font-bold font-mono", s.color)}>
                    {s.value}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.label} headlines
                  </p>
                </div>
              ))}
            </div>

            {/* Bar breakdown */}
            {data.headline_count > 0 && (
              <div className="space-y-1">
                <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                  <div
                    className="bg-emerald-500 transition-all"
                    style={{
                      width: `${(data.bullish_count / data.headline_count) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-yellow-500/50 transition-all"
                    style={{
                      width: `${(data.neutral_count / data.headline_count) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-red-500 transition-all"
                    style={{
                      width: `${(data.bearish_count / data.headline_count) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Total: {data.headline_count} headlines</span>
                  {data.fetched_at && (
                    <span>
                      Updated:{" "}
                      {new Date(data.fetched_at).toLocaleTimeString("id-ID", {
                        timeZone: "Asia/Jakarta",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      WIB
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Sources */}
            {data.sources_checked.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.sources_checked.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] px-1.5 py-0.5 rounded-md bg-background/30 text-muted-foreground border border-border/30"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Headlines */}
          {data.headlines.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  Headlines Terkait ({data.headlines.length})
                </h3>
              </div>
              <div className="divide-y divide-border">
                {data.headlines.map((h, i) => (
                  <div
                    key={i}
                    className="px-4 py-3 flex items-start gap-3 hover:bg-secondary/20 transition-colors"
                  >
                    {/* Sentiment dot */}
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full mt-1.5 shrink-0",
                        h.score >= 0.15
                          ? "bg-emerald-500"
                          : h.score <= -0.15
                            ? "bg-red-500"
                            : "bg-yellow-500",
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={h.url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-foreground hover:text-primary transition-colors line-clamp-2 leading-relaxed"
                        >
                          {h.title}
                        </a>
                        {h.url && (
                          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {h.source}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ·
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-mono font-medium",
                            HEADLINE_SENTIMENT_COLOR[h.sentiment] ??
                              "text-muted-foreground",
                          )}
                        >
                          {h.score > 0 ? "+" : ""}
                          {h.score.toFixed(2)} {h.sentiment.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">
                          rel: {(h.relevance * 100).toFixed(0)}%
                        </span>
                        {h.keywords.length > 0 && (
                          <>
                            <span className="text-[10px] text-muted-foreground">
                              ·
                            </span>
                            {h.keywords.slice(0, 2).map((k) => (
                              <span
                                key={k}
                                className="text-[10px] text-muted-foreground/70 font-mono"
                              >
                                {k}
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Sentiment icon */}
                    <div className="shrink-0">
                      {h.score >= 0.15 ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : h.score <= -0.15 ? (
                        <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                      ) : (
                        <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No headlines */}
          {data.headlines.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-xl">
              <Newspaper className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                Tidak ada headline yang relevan ditemukan
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Sumber berita terbatas pada yang dikonfigurasi di server backend.
              </p>
            </div>
          )}

          {/* Interpretation guide */}
          <div className="rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">
              Cara membaca hasil ini:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <p>
                  <span className="text-emerald-400 font-medium">
                    🟢 STRONG_BULLISH (≥0.4)
                  </span>{" "}
                  — News sangat positif, konfirmasi sinyal BUY
                </p>
                <p>
                  <span className="text-green-400 font-medium">
                    🟩 BULLISH (0.15-0.4)
                  </span>{" "}
                  — Berita mendukung, sinyal BUY lebih kuat
                </p>
                <p>
                  <span className="text-muted-foreground font-medium">
                    ⬜ NEUTRAL (-0.15 to 0.15)
                  </span>{" "}
                  — Berita campuran, fokus ke teknikal
                </p>
              </div>
              <div className="space-y-1">
                <p>
                  <span className="text-red-400 font-medium">
                    🟥 BEARISH (-0.4 to -0.15)
                  </span>{" "}
                  — Berita negatif, hati-hati
                </p>
                <p>
                  <span className="text-red-500 font-medium">
                    🔴 STRONG_BEARISH (≤-0.4)
                  </span>{" "}
                  — Berita sangat negatif, pertimbangkan skip
                </p>
                <p>
                  <span className="text-orange-400 font-medium">
                    🚨 CONFLICT
                  </span>{" "}
                  — Sinyal teknikal bertentangan dengan sentiment news
                </p>
              </div>
            </div>
            <p className="text-muted-foreground/70 pt-1">
              Sentiment bukan sinyal trading — gunakan sebagai filter tambahan.
              Konflik berat tidak selalu berarti skip, tapi perlu size lebih
              kecil dan stop loss lebih ketat.
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !data && !error && (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-xl">
          <Radio className="w-10 h-10 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">
            Masukkan ticker dan klik Analyze
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Ambil headline dari Reuters, Bloomberg, CoinDesk, Reddit, dan lebih
            banyak lagi
          </p>
        </div>
      )}
    </div>
  );
}
