"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Play,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Clock,
  Award,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TierStat {
  tier: string;
  total: number;
  wins: number;
  losses: number;
  win_rate: number;
  avg_r_win: number;
  avg_r_loss: number;
  profit_factor: number;
  expectancy: number;
  total_r: number;
}

interface MonthStat {
  month: string;
  trades: number;
  wins: number;
  win_rate: number;
  total_r: number;
}

interface Trade {
  entry_date: string;
  exit_date: string | null;
  tier: string;
  entry: number;
  stop_loss: number;
  take_profit: number;
  exit_price: number | null;
  outcome: string;
  pnl_r: number;
  holding_candles: number;
  gates_passed: string[];
}

interface BacktestData {
  ticker: string;
  market: string;
  interval: string;
  start_date: string;
  end_date: string;
  total_candles: number;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_r: number;
  profit_factor: number;
  max_drawdown_r: number;
  max_drawdown_pct: number;
  avg_holding_candles: number;
  best_period: string;
  worst_period: string;
  sharpe_ratio: number;
  sortino_ratio: number;
  tier_stats: Record<string, TierStat>;
  monthly_stats: MonthStat[];
  capital_curve: number[];
  trades: Trade[];
  error?: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const MARKET_OPTIONS = [
  {
    value: "crypto",
    label: "Crypto",
    emoji: "🔷",
    placeholder: "BTCUSDT, ETHUSDT",
  },
  {
    value: "stock_us",
    label: "US Stock",
    emoji: "🇺🇸",
    placeholder: "AAPL, NVDA, TSLA",
  },
  {
    value: "stock_idx",
    label: "IDX Stock",
    emoji: "🇮🇩",
    placeholder: "BBCA.JK, TLKM.JK",
  },
  {
    value: "forex",
    label: "Forex",
    emoji: "💱",
    placeholder: "EUR_USD, GBP_USD",
  },
];

const INTERVAL_OPTIONS = [
  { value: "1d", label: "Daily" },
  { value: "4h", label: "4 Hours" },
  { value: "1h", label: "1 Hour" },
];

const TIER_COLORS: Record<string, string> = {
  SNIPER: "text-emerald-400",
  PRECISION: "text-blue-400",
  STANDARD: "text-purple-400",
  SCOUT: "text-yellow-400",
  RADAR: "text-red-400",
};

const TIER_BG: Record<string, string> = {
  SNIPER: "bg-emerald-400/10 border-emerald-400/20",
  PRECISION: "bg-blue-400/10 border-blue-400/20",
  STANDARD: "bg-purple-400/10 border-purple-400/20",
  SCOUT: "bg-yellow-400/10 border-yellow-400/20",
  RADAR: "bg-red-400/10 border-red-400/20",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  trend,
  small,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <p
        className={cn(
          small ? "text-base" : "text-xl",
          "font-bold font-mono",
          trend === "up"
            ? "text-profit"
            : trend === "down"
              ? "text-loss"
              : "text-foreground",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// Simple equity curve visualization (pure CSS bars)
function EquityCurve({ curve }: { curve: number[] }) {
  if (!curve || curve.length < 2) return null;

  const min = Math.min(...curve);
  const max = Math.max(...curve);
  const range = max - min || 0.01;
  const final = curve[curve.length - 1];
  const isProfit = final >= 1.0;

  // Sample to max 60 points for display
  const step = Math.max(1, Math.floor(curve.length / 60));
  const sampled = curve.filter(
    (_, i) => i % step === 0 || i === curve.length - 1,
  );

  return (
    <div className="p-4">
      <div className="flex items-end gap-px h-24">
        {sampled.map((v, i) => {
          const pct = ((v - min) / range) * 100;
          const isAbove = v >= 1.0;
          return (
            <div key={i} className="flex-1 flex flex-col justify-end">
              <div
                className={cn(
                  "rounded-sm min-h-px transition-all",
                  isAbove ? "bg-emerald-500/60" : "bg-red-500/60",
                )}
                style={{ height: `${Math.max(2, pct)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
        <span>Start: 1.00x</span>
        <span
          className={cn(
            "font-mono font-semibold",
            isProfit ? "text-profit" : "text-loss",
          )}
        >
          End: {final.toFixed(3)}x ({isProfit ? "+" : ""}
          {((final - 1) * 100).toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function BacktestContent() {
  const [market, setMarket] = useState("crypto");
  const [ticker, setTicker] = useState("");
  const [interval, setInterval] = useState("1d");
  const [years, setYears] = useState(2);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTrades, setShowTrades] = useState(false);

  const run = useCallback(async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const url = `${API}/backtest/run?ticker=${encodeURIComponent(ticker.trim().toUpperCase())}&market=${market}&interval=${interval}&years=${years}`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [ticker, market, interval, years]);

  const mConfig = MARKET_OPTIONS.find((m) => m.value === market);

  return (
    <div className="space-y-5">
      {/* Config panel */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          Backtesting Engine
        </h2>

        {/* Market */}
        <div className="flex gap-1.5 flex-wrap">
          {MARKET_OPTIONS.map((m) => (
            <button
              key={m.value}
              onClick={() => {
                setMarket(m.value);
                setResult(null);
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

        {/* Ticker + controls */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder={mConfig?.placeholder}
            className="flex-1 min-w-40 px-3 py-2 text-sm rounded-lg border border-border bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />

          <div className="flex gap-1.5">
            {INTERVAL_OPTIONS.map((iv) => (
              <button
                key={iv.value}
                onClick={() => setInterval(iv.value)}
                className={cn(
                  "px-2.5 py-2 text-xs rounded-lg border transition-all",
                  interval === iv.value
                    ? "bg-primary/15 text-primary border-primary/25"
                    : "text-muted-foreground border-border hover:text-foreground",
                )}
              >
                {iv.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            {[1, 2, 3].map((y) => (
              <button
                key={y}
                onClick={() => setYears(y)}
                className={cn(
                  "px-2.5 py-2 text-xs rounded-lg border transition-all",
                  years === y
                    ? "bg-primary/15 text-primary border-primary/25"
                    : "text-muted-foreground border-border hover:text-foreground",
                )}
              >
                {y}Y
              </button>
            ))}
          </div>

          <button
            onClick={run}
            disabled={loading || !ticker.trim()}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {loading ? "Running..." : "Run Backtest"}
          </button>
        </div>

        {/* Info */}
        <p className="text-[11px] text-muted-foreground">
          Menjalankan gate logic terhadap data historis. Walk-forward simulation
          — tidak ada lookahead bias. Estimasi waktu: 10–30 detik. Hasil
          di-cache 1 jam.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-destructive/20 bg-destructive/5 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl border border-border shimmer"
            />
          ))}
          <div className="text-center text-xs text-muted-foreground animate-pulse">
            Fetching historical data dan menjalankan simulasi...
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && result && (
        <div className="space-y-5 animate-fade-in">
          {/* Period header */}
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-base font-bold text-foreground">
                {result.ticker}
              </h3>
              <p className="text-xs text-muted-foreground">
                {result.start_date.slice(0, 10)} →{" "}
                {result.end_date.slice(0, 10)}
                {" · "}
                {result.total_candles} candles {" · "} {result.interval}
              </p>
            </div>
            <span
              className={cn(
                "text-sm font-semibold px-3 py-1 rounded-lg border",
                result.win_rate >= 55
                  ? "text-profit bg-profit/10 border-profit/20"
                  : result.win_rate >= 45
                    ? "text-warning bg-warning/10 border-warning/20"
                    : "text-loss bg-loss/10 border-loss/20",
              )}
            >
              {result.win_rate}% win rate
            </span>
          </div>

          {/* Key stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Total Trades"
              value={String(result.total_trades)}
              sub={`${result.wins}W · ${result.losses}L`}
            />
            <StatCard
              label="Total R"
              value={`${result.total_r > 0 ? "+" : ""}${result.total_r}R`}
              trend={result.total_r > 0 ? "up" : "down"}
              sub="Return in R"
            />
            <StatCard
              label="Profit Factor"
              value={String(result.profit_factor)}
              trend={
                result.profit_factor >= 1.5
                  ? "up"
                  : result.profit_factor < 1
                    ? "down"
                    : "neutral"
              }
              sub="Gross profit / loss"
            />
            <StatCard
              label="Max Drawdown"
              value={`${result.max_drawdown_pct}%`}
              trend="down"
              sub={`${result.max_drawdown_r.toFixed(2)}R`}
            />
            <StatCard
              label="Sharpe Ratio"
              value={String(result.sharpe_ratio)}
              trend={result.sharpe_ratio >= 1 ? "up" : "neutral"}
              sub="Risk-adjusted return"
              small
            />
            <StatCard
              label="Sortino Ratio"
              value={String(result.sortino_ratio)}
              trend={result.sortino_ratio >= 1 ? "up" : "neutral"}
              sub="Downside risk-adj"
              small
            />
            <StatCard
              label="Best Period"
              value={result.best_period}
              trend="up"
              sub="Highest win rate"
              small
            />
            <StatCard
              label="Worst Period"
              value={result.worst_period}
              trend="down"
              sub="Lowest win rate"
              small
            />
          </div>

          {/* Equity curve */}
          <Section title="Capital Curve (normalized, 2% risk/trade)">
            <EquityCurve curve={result.capital_curve} />
          </Section>

          {/* Tier stats */}
          <Section title="Win Rate per Tier">
            {Object.keys(result.tier_stats).length === 0 ? (
              <div className="p-5 text-sm text-muted-foreground">
                Tidak ada trade yang terjadi pada backtest ini.
              </div>
            ) : (
              <div className="divide-y divide-border">
                <div className="grid grid-cols-[80px_50px_70px_70px_70px_70px_1fr] gap-px bg-border text-[10px] text-muted-foreground uppercase font-medium">
                  {[
                    "Tier",
                    "Total",
                    "Win%",
                    "Avg Win",
                    "Avg Loss",
                    "PF",
                    "Expectancy",
                  ].map((h) => (
                    <div key={h} className="bg-card px-3 py-2">
                      {h}
                    </div>
                  ))}
                </div>
                {Object.values(result.tier_stats)
                  .sort((a, b) => b.win_rate - a.win_rate)
                  .map((ts) => (
                    <div
                      key={ts.tier}
                      className="grid grid-cols-[80px_50px_70px_70px_70px_70px_1fr] gap-px bg-border"
                    >
                      <div
                        className={cn(
                          "bg-card px-3 py-3 text-xs font-semibold",
                          TIER_COLORS[ts.tier],
                        )}
                      >
                        {ts.tier}
                      </div>
                      <div className="bg-card px-3 py-3 text-xs text-foreground font-mono">
                        {ts.total}
                      </div>
                      <div className="bg-card px-3 py-3">
                        <span
                          className={cn(
                            "text-xs font-mono font-semibold",
                            ts.win_rate >= 60
                              ? "text-profit"
                              : ts.win_rate >= 45
                                ? "text-warning"
                                : "text-loss",
                          )}
                        >
                          {ts.win_rate}%
                        </span>
                      </div>
                      <div className="bg-card px-3 py-3 text-xs font-mono text-profit">
                        +{ts.avg_r_win}R
                      </div>
                      <div className="bg-card px-3 py-3 text-xs font-mono text-loss">
                        -{ts.avg_r_loss}R
                      </div>
                      <div className="bg-card px-3 py-3 text-xs font-mono text-foreground">
                        {ts.profit_factor}
                      </div>
                      <div className="bg-card px-3 py-3">
                        <span
                          className={cn(
                            "text-xs font-mono",
                            ts.expectancy > 0 ? "text-profit" : "text-loss",
                          )}
                        >
                          {ts.expectancy > 0 ? "+" : ""}
                          {ts.expectancy}R
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Section>

          {/* Monthly breakdown */}
          {result.monthly_stats.length > 0 && (
            <Section title="P&L Bulanan (dalam R)">
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {result.monthly_stats.map((m) => (
                    <div
                      key={m.month}
                      className={cn(
                        "rounded-lg border p-2.5 text-center min-w-[80px]",
                        m.total_r > 0
                          ? "border-profit/20 bg-profit/5"
                          : m.total_r < 0
                            ? "border-loss/20 bg-loss/5"
                            : "border-border bg-secondary/30",
                      )}
                    >
                      <p className="text-[10px] text-muted-foreground">
                        {m.month}
                      </p>
                      <p
                        className={cn(
                          "text-xs font-mono font-semibold mt-0.5",
                          m.total_r > 0
                            ? "text-profit"
                            : m.total_r < 0
                              ? "text-loss"
                              : "text-foreground",
                        )}
                      >
                        {m.total_r > 0 ? "+" : ""}
                        {m.total_r}R
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {m.win_rate}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* Trades table */}
          {result.trades.length > 0 && (
            <Section title={`Trade History (${result.trades.length} trades)`}>
              <div className="px-5 py-3 border-b border-border">
                <button
                  onClick={() => setShowTrades((t) => !t)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showTrades ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                  {showTrades ? "Hide trades" : "Show trade list"}
                </button>
              </div>
              {showTrades && (
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-[100px_80px_80px_60px_60px_1fr] gap-px bg-border text-[10px] text-muted-foreground uppercase font-medium min-w-[500px]">
                    {[
                      "Entry Date",
                      "Tier",
                      "Outcome",
                      "P&L R",
                      "Hold",
                      "Gates",
                    ].map((h) => (
                      <div key={h} className="bg-card px-3 py-2">
                        {h}
                      </div>
                    ))}
                  </div>
                  {result.trades.map((t, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[100px_80px_80px_60px_60px_1fr] gap-px bg-border min-w-[500px]"
                    >
                      <div className="bg-card px-3 py-2.5 text-[10px] font-mono text-muted-foreground">
                        {t.entry_date.slice(0, 10)}
                      </div>
                      <div
                        className={cn(
                          "bg-card px-3 py-2.5 text-[10px] font-semibold",
                          TIER_COLORS[t.tier],
                        )}
                      >
                        {t.tier}
                      </div>
                      <div className="bg-card px-3 py-2.5">
                        <span
                          className={cn(
                            "text-[10px] font-medium",
                            t.outcome === "win" ? "text-profit" : "text-loss",
                          )}
                        >
                          {t.outcome === "win" ? "✅ Win" : "❌ Loss"}
                        </span>
                      </div>
                      <div className="bg-card px-3 py-2.5">
                        <span
                          className={cn(
                            "text-[10px] font-mono",
                            t.pnl_r >= 0 ? "text-profit" : "text-loss",
                          )}
                        >
                          {t.pnl_r > 0 ? "+" : ""}
                          {t.pnl_r.toFixed(2)}R
                        </span>
                      </div>
                      <div className="bg-card px-3 py-2.5 text-[10px] text-muted-foreground font-mono">
                        {t.holding_candles}c
                      </div>
                      <div className="bg-card px-3 py-2.5 text-[10px] text-muted-foreground">
                        {(t.gates_passed ?? []).slice(0, 3).join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Interpretation */}
          <div className="px-4 py-3.5 rounded-xl border border-border bg-secondary/30 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground">Interpretasi hasil:</p>
            <p>
              · <span className="text-foreground">Profit Factor {">"} 1.5</span>{" "}
              = sistem profitable secara historis
            </p>
            <p>
              · <span className="text-foreground">Sharpe {">"} 1.0</span> =
              return baik relatif terhadap risiko
            </p>
            <p>
              · <span className="text-foreground">Expectancy {">"} 0</span> =
              sistem menguntungkan per trade dalam jangka panjang
            </p>
            <p>
              · <span className="text-foreground">Max Drawdown {"<"} 20%</span>{" "}
              = risiko manageable
            </p>
            <p className="text-muted-foreground/70 pt-1">
              ⚠️ Backtest tidak menjamin hasil forward — past performance bukan
              jaminan masa depan. Gunakan sebagai validasi, bukan satu-satunya
              basis keputusan.
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && !error && (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-xl">
          <BarChart3 className="w-10 h-10 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">
            Pilih ticker dan klik Run Backtest
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Data historis 1–3 tahun · Gate logic yang sama dengan forward scan
          </p>
        </div>
      )}
    </div>
  );
}
