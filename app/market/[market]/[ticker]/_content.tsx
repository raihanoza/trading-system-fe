"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { formatPrice, cn } from "@/lib/utils";
import { apiGet } from "@/lib/api";
import { ApiErrorNotice, EmptyState } from "@/components/system/StateNotice";
import {
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Target,
  Zap,
  Newspaper,
  BarChart3,
} from "lucide-react";

const TradingChart = dynamic(() => import("@/components/charts/TradingChart"), {
  ssr: false,
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface DetailData {
  ticker: string;
  display: string;
  submarket: string;
  market: string;
  current_price: number;
  change_24h_pct: number;
  change_direction: string;
  trend: string;
  structure_pattern: string;
  last_high: number | null;
  last_low: number | null;
  trend_strength: number;
  rsi: number;
  ma_position: string;
  ma_distance_pct: number;
  ma50: number;
  volume_status: string;
  volume_ratio: number;
  support: number | null;
  resistance: number | null;
  support_dist_pct: number | null;
  resistance_dist_pct: number | null;
  has_signal: boolean;
  signal_tier: string | null;
  signal_action: string | null;
  signal_id: number | null;
  sentiment_label: string | null;
  sentiment_score: number | null;
  recommendation: {
    action: string;
    label: string;
    score: number;
    reasons: string[];
  };
}

interface Props {
  market: string;
  ticker: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const TREND_STYLE: Record<
  string,
  { icon: typeof TrendingUp; color: string; bg: string; label: string }
> = {
  uptrend: {
    icon: TrendingUp,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    label: "Uptrend",
  },
  downtrend: {
    icon: TrendingDown,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    label: "Downtrend",
  },
  sideways: {
    icon: Minus,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    label: "Sideways",
  },
  contracting: {
    icon: Activity,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    label: "Contracting",
  },
  expanding: {
    icon: Activity,
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    label: "Expanding",
  },
  unknown: {
    icon: Minus,
    color: "text-muted-foreground",
    bg: "bg-secondary border-border",
    label: "Unknown",
  },
};

const ACTION_STYLE: Record<string, string> = {
  STRONG_BUY: "text-emerald-300 bg-emerald-500/15 border-emerald-500/40",
  BUY: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  WAIT: "text-muted-foreground bg-secondary border-border",
  SELL: "text-red-400 bg-red-500/10 border-red-500/25",
  STRONG_SELL: "text-red-300 bg-red-500/15 border-red-500/40",
};

const DEFAULT_INTERVAL: Record<string, string> = {
  crypto: "4h",
  forex: "1h",
  stock_idx: "1d",
  stock_us: "1d",
  stock: "1d",
};

const INTERVALS = ["1h", "4h", "1d", "1w"];

// ── Sub components ────────────────────────────────────────────────────────────

function MetricBox({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p
        className={cn(
          "text-base font-bold font-mono mt-1",
          color ?? "text-foreground",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({
  title,
  children,
  icon: Icon,
  action,
}: {
  title: string;
  children: React.ReactNode;
  icon?: typeof TrendingUp;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DetailContent({ market, ticker }: Props) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [interval, setInterval] = useState(DEFAULT_INTERVAL[market] ?? "1d");

  useEffect(() => {
    let cancelled = false;
    // Fetch per-market overview (lebih ringan). setState hanya di callback.
    apiGet<{ rows?: DetailData[] }>(`/market/overview/${encodeURIComponent(market)}`)
      .then((overview) => {
        if (cancelled) return;
        const row = overview.rows?.find((r) => r.ticker === ticker) ?? null;
        setData(row);
        setNotFound(!row);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [market, ticker, attempt]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 rounded-xl border border-border shimmer" />
        <div className="h-96 rounded-xl border border-border shimmer" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl border border-border shimmer"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link
          href="/market"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Market Overview
        </Link>
        {error != null ? (
          <ApiErrorNotice error={error} action={`memuat ${ticker}`} />
        ) : (
          <EmptyState
            title={notFound ? `${ticker} tidak ada di watchlist ${market}.` : "Data tidak ditemukan."}
            description="Overview hanya memuat ticker watchlist yang sudah ter-cache di backend."
          />
        )}
      </div>
    );
  }

  const trendStyle = TREND_STYLE[data.trend] ?? TREND_STYLE.unknown;
  const TrendIcon = trendStyle.icon;

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <Link
        href="/market"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Market Overview
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono text-foreground">
              {data.display}
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-md bg-secondary border border-border text-muted-foreground uppercase">
              {data.submarket}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{data.ticker}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold font-mono text-foreground">
            {formatPrice(data.current_price, data.market)}
          </p>
          <p
            className={cn(
              "text-sm font-mono",
              data.change_24h_pct > 0
                ? "text-emerald-400"
                : data.change_24h_pct < 0
                  ? "text-red-400"
                  : "text-muted-foreground",
            )}
          >
            {data.change_24h_pct > 0 ? "+" : ""}
            {data.change_24h_pct.toFixed(2)}% (24h)
          </p>
        </div>
      </div>

      {/* Recommendation banner */}
      <div
        className={cn(
          "rounded-xl border p-4 flex items-start gap-4",
          ACTION_STYLE[data.recommendation.action] ?? ACTION_STYLE.WAIT,
        )}
      >
        <Target className="w-6 h-6 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-lg font-bold">
              {data.recommendation.label}
            </span>
            <span className="text-xs opacity-70">
              Score: {data.recommendation.score > 0 ? "+" : ""}
              {data.recommendation.score}
            </span>
          </div>
          {data.recommendation.reasons.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {data.recommendation.reasons.map((r, i) => (
                <li key={i} className="text-xs opacity-90">
                  · {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Chart */}
      <Section
        title="Price Chart"
        icon={BarChart3}
        action={
          <div className="flex gap-1">
            {INTERVALS.map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={cn(
                  "px-2.5 py-1 text-[11px] rounded-md border transition-all",
                  interval === iv
                    ? "bg-primary/15 text-primary border-primary/25"
                    : "text-muted-foreground border-border hover:text-foreground",
                )}
              >
                {iv.toUpperCase()}
              </button>
            ))}
          </div>
        }
      >
        <div className="h-[500px]">
          <TradingChart
            ticker={ticker}
            market={market}
            interval={interval}
            signalId={data.signal_id ?? undefined}
          />
        </div>
      </Section>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricBox
          label="Trend"
          value={trendStyle.label}
          sub={data.structure_pattern}
          color={trendStyle.color}
        />
        <MetricBox
          label="RSI (14)"
          value={data.rsi.toFixed(1)}
          sub={
            data.rsi >= 70
              ? "Overbought"
              : data.rsi <= 30
                ? "Oversold"
                : "Neutral"
          }
          color={
            data.rsi >= 70
              ? "text-red-400"
              : data.rsi <= 30
                ? "text-emerald-400"
                : "text-foreground"
          }
        />
        <MetricBox
          label="MA50"
          value={formatPrice(data.ma50, data.market)}
          sub={`Price ${data.ma_position} (${data.ma_distance_pct > 0 ? "+" : ""}${data.ma_distance_pct.toFixed(1)}%)`}
          color={
            data.ma_position === "above"
              ? "text-emerald-400"
              : data.ma_position === "below"
                ? "text-red-400"
                : "text-foreground"
          }
        />
        <MetricBox
          label="Volume"
          value={`${data.volume_ratio.toFixed(1)}x avg`}
          sub={data.volume_status.replace("_", " ")}
          color={
            data.volume_status === "spike"
              ? "text-orange-400"
              : "text-foreground"
          }
        />
        <MetricBox
          label="Resistance"
          value={
            data.resistance ? formatPrice(data.resistance, data.market) : "—"
          }
          sub={
            data.resistance_dist_pct !== null
              ? `+${data.resistance_dist_pct.toFixed(1)}% away`
              : ""
          }
          color="text-red-400"
        />
        <MetricBox
          label="Support"
          value={data.support ? formatPrice(data.support, data.market) : "—"}
          sub={
            data.support_dist_pct !== null
              ? `-${data.support_dist_pct.toFixed(1)}% away`
              : ""
          }
          color="text-emerald-400"
        />
      </div>

      {/* Structure detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Market Structure" icon={TrendingUp}>
          <div className="p-4 space-y-3">
            <div className={cn("rounded-lg border p-3", trendStyle.bg)}>
              <div className="flex items-center gap-2 mb-1">
                <TrendIcon className={cn("w-4 h-4", trendStyle.color)} />
                <span className={cn("text-sm font-semibold", trendStyle.color)}>
                  {trendStyle.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Pattern terakhir:{" "}
                <span className="font-mono text-foreground">
                  {data.structure_pattern}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Strength:{" "}
                <span className="text-foreground">
                  {data.trend_strength}/100
                </span>
              </p>
            </div>

            {data.last_high && data.last_low && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-secondary/50 p-2.5">
                  <p className="text-[10px] text-muted-foreground">Last High</p>
                  <p className="font-mono font-semibold text-foreground">
                    {formatPrice(data.last_high, data.market)}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2.5">
                  <p className="text-[10px] text-muted-foreground">Last Low</p>
                  <p className="font-mono font-semibold text-foreground">
                    {formatPrice(data.last_low, data.market)}
                  </p>
                </div>
              </div>
            )}

            <div className="text-[11px] text-muted-foreground space-y-1">
              {data.trend === "uptrend" && (
                <p>
                  ✓ Harga membentuk Higher High & Higher Low — trend bullish
                  valid
                </p>
              )}
              {data.trend === "downtrend" && (
                <p>
                  ✓ Harga membentuk Lower High & Lower Low — trend bearish valid
                </p>
              )}
              {data.trend === "contracting" && (
                <p>· Range mengecil, kemungkinan breakout dalam waktu dekat</p>
              )}
              {data.trend === "expanding" && (
                <p>· Volatility tinggi, hindari trade tanpa konfirmasi</p>
              )}
              {data.trend === "sideways" && (
                <p>· Tidak ada arah jelas, tunggu break struktur</p>
              )}
            </div>
          </div>
        </Section>

        <Section title="Signal & Sentiment" icon={Zap}>
          <div className="p-4 space-y-3">
            {/* Signal */}
            {data.has_signal && data.signal_tier ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase">
                    Active Signal
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded",
                      "text-primary",
                    )}
                  >
                    {data.signal_action}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground mt-1">
                  {data.signal_tier} Tier
                </p>
                {data.signal_id && (
                  <Link
                    href={`/trades`}
                    className="text-[10px] text-primary hover:underline mt-1 inline-block"
                  >
                    Signal ID: #{data.signal_id} →
                  </Link>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Belum ada signal aktif untuk asset ini
                </p>
              </div>
            )}

            {/* Sentiment */}
            {data.sentiment_label ? (
              <div
                className={cn(
                  "rounded-lg border p-3",
                  data.sentiment_label.includes("BULLISH")
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : data.sentiment_label.includes("BEARISH")
                      ? "border-red-500/20 bg-red-500/5"
                      : "border-border bg-secondary/30",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Newspaper className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground uppercase">
                      News Sentiment
                    </span>
                  </div>
                  {data.sentiment_score !== null && (
                    <span
                      className={cn(
                        "text-[10px] font-mono",
                        data.sentiment_score > 0.1
                          ? "text-emerald-400"
                          : data.sentiment_score < -0.1
                            ? "text-red-400"
                            : "text-muted-foreground",
                      )}
                    >
                      {data.sentiment_score > 0 ? "+" : ""}
                      {data.sentiment_score.toFixed(2)}
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    "text-sm font-semibold mt-1",
                    data.sentiment_label.includes("BULLISH")
                      ? "text-emerald-400"
                      : data.sentiment_label.includes("BEARISH")
                        ? "text-red-400"
                        : "text-foreground",
                  )}
                >
                  {data.sentiment_label.replace(/_/g, " ")}
                </p>
                <Link
                  href={`/sentiment`}
                  className="text-[10px] text-primary hover:underline mt-1 inline-block"
                >
                  Lihat detail headlines →
                </Link>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Sentiment belum di-scan
                </p>
                <Link
                  href={`/sentiment`}
                  className="text-[10px] text-primary hover:underline mt-1 inline-block"
                >
                  Scan sentiment →
                </Link>
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Refresh button */}
      <div className="flex justify-center">
        <button
          onClick={() => {
            setLoading(true);
            setAttempt((n) => n + 1);
          }}
          className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-border bg-card hover:bg-secondary transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Analysis
        </button>
      </div>
    </div>
  );
}
