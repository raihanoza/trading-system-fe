"use client";

import { useState, useEffect } from "react";
import { formatIDR, cn } from "@/lib/utils";
import { apiGet } from "@/lib/api";
import WeeklyRecap from "@/components/stats/WeeklyRecap";
import { ApiErrorNotice } from "@/components/system/StateNotice";

interface Summary {
  total_trades: number;
  closed_trades: number;
  open_trades: number;
  win_count: number;
  loss_count: number;
  win_rate_pct: number;
  total_pnl_idr: number;
  daily_pnl_idr: number;
  weekly_pnl_idr: number;
  avg_win_idr: number;
  avg_loss_idr: number;
  avg_rr: number;
  profit_factor: number;
  current_streak: number;
  streak_type: string;
}
interface TierRow {
  tier: string;
  total: number;
  wins: number;
  losses: number;
  win_rate: number | null;
  total_pnl: number;
}
interface MarketRow {
  market: string;
  total: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_pnl: number;
}
interface GateRow {
  gate: string;
  trades: number;
  wins: number;
  win_rate: number;
}
interface TimelinePoint {
  date: string;
  pnl: number;
  cumulative: number;
  ticker: string;
  outcome: string;
}
interface MonthlyRow {
  month: string;
  trades: number;
  wins: number;
  pnl: number;
  win_rate: number;
}
interface SignalAccuracy {
  total_signals_generated: number;
  signals_acted_on: number;
  signals_ignored: number;
  act_rate_pct: number;
  by_tier: { tier: string; generated: number; acted: number }[];
}

const MARKET_FILTERS = [
  { value: "all", label: "All Markets", emoji: "🌐" },
  { value: "stock", label: "Stock (IDX+US)", emoji: "📈" },
  { value: "stock_idx", label: "IDX", emoji: "🇮🇩" },
  { value: "stock_us", label: "US", emoji: "🇺🇸" },
  { value: "crypto", label: "Crypto", emoji: "🔷" },
  { value: "forex", label: "Forex", emoji: "💱" },
];

const TIER_COLORS: Record<string, string> = {
  SNIPER: "text-emerald-400",
  PRECISION: "text-blue-400",
  STANDARD: "text-purple-400",
  SCOUT: "text-yellow-400",
  RADAR: "text-red-400",
};
const TIER_BG: Record<string, string> = {
  SNIPER: "bg-emerald-400",
  PRECISION: "bg-blue-400",
  STANDARD: "bg-purple-400",
  SCOUT: "bg-yellow-400",
  RADAR: "bg-red-400",
};
const MARKET_LABEL: Record<string, string> = {
  stock_idx: "🇮🇩 IDX",
  stock_us: "🇺🇸 US",
  stock: "📈 Stock",
  crypto: "🔷 Crypto",
  forex: "💱 Forex",
};

/**
 * Warna lampu lalu lintas (≥65 % hijau, <50 % merah) dicabut 4 Okt 2026:
 * win rate tanpa besar menang/kalah tidak menyatakan untung atau rugi —
 * kandidat CM1 ber-win rate ±60 % tetap rugi per trade. Jumlah sampel
 * ditampilkan di samping angkanya.
 */
function WinRateBar({ rate, total }: { rate: number | null; total: number }) {
  if (rate === null || total === 0)
    return <span className="text-xs text-muted-foreground">Belum ada data</span>;
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-muted-foreground/60"
          style={{ width: `${rate}%` }}
        />
      </div>
      <span className="text-xs font-semibold font-mono w-16 text-right text-foreground">
        {rate}%
        <span className="ml-1 text-[10px] font-normal text-muted-foreground">n={total}</span>
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <p
        className={cn(
          "text-xl font-bold font-mono",
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

export default function StatsContent() {
  const [activeMarket, setActiveMarket] = useState("all");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [gates, setGates] = useState<GateRow[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [sigAcc, setSigAcc] = useState<SignalAccuracy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  // Dulu tujuh `fetch(...).then(r => r.json())` tanpa memeriksa status: 500
  // dari backend dibaca sebagai objek kosong dan layar tampil "belum ada
  // data". Sekarang galat apa pun membatalkan seluruh muatan dan ditampilkan.
  useEffect(() => {
    let cancelled = false;
    const q = activeMarket !== "all" ? `?market=${encodeURIComponent(activeMarket)}` : "";
    Promise.all([
      apiGet<Summary>(`/analytics/summary${q}`),
      apiGet<{ tiers?: TierRow[] }>(`/analytics/by-tier${q}`),
      apiGet<{ markets?: MarketRow[] }>(`/analytics/by-market${q}`),
      apiGet<{ gates?: GateRow[] }>(`/analytics/gate-accuracy${q}`),
      apiGet<{ timeline?: TimelinePoint[] }>(`/analytics/pnl-timeline${q}`),
      apiGet<{ monthly?: MonthlyRow[] }>(`/analytics/monthly${q}`),
      apiGet<SignalAccuracy>(`/analytics/signal-accuracy${q}`),
    ])
      .then(([s, t, m, g, tl, mo, sa]) => {
        if (cancelled) return;
        setSummary(s);
        setTiers(t.tiers ?? []);
        setMarkets(m.markets ?? []);
        setGates(g.gates ?? []);
        setTimeline(tl.timeline ?? []);
        setMonthly(mo.monthly ?? []);
        setSigAcc(sa);
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
  }, [activeMarket, attempt]);

  const selectMarket = (m: string) => {
    if (m === activeMarket) return;
    setLoading(true);
    setActiveMarket(m);
  };

  const activeLabel =
    MARKET_FILTERS.find((f) => f.value === activeMarket)?.label ?? "All";

  return (
    <div className="space-y-5">
      {/* Market Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {MARKET_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => selectMarket(f.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              activeMarket === f.value
                ? "bg-primary/15 text-primary border-primary/25"
                : "text-muted-foreground border-border hover:text-foreground hover:bg-secondary",
            )}
          >
            <span>{f.emoji}</span>
            <span>{f.label}</span>
          </button>
        ))}
        {loading && (
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin ml-2 self-center" />
        )}
      </div>

      {/* Rekap mingguan (D7) — SENGAJA di atas pagar "belum ada trade".
          Justru saat belum ada apa-apa, fokusnya paling berguna: "mesinnya
          tidak berjalan" / "jurnal tidak dipakai". Menyembunyikannya bersama
          statistik trade membuat dua masalah itu tak pernah terlihat. */}
      <WeeklyRecap market={activeMarket} />

      {/* Error */}
      {error != null && (
        <ApiErrorNotice
          error={error}
          action="memuat analytics"
          onRetry={() => {
            setLoading(true);
            setAttempt((n) => n + 1);
          }}
        />
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-xl border border-border shimmer"
              />
            ))}
          </div>
          <div className="h-48 rounded-xl border border-border shimmer" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="h-64 rounded-xl border border-border shimmer" />
            <div className="h-64 rounded-xl border border-border shimmer" />
          </div>
        </div>
      )}

      {/* No data */}
      {!loading && !error && (!summary || summary.total_trades === 0) && (
        <div className="flex flex-col items-center justify-center py-24 border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted-foreground">
            Belum ada trade untuk{" "}
            <span className="text-foreground font-medium">{activeLabel}</span>
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Tambahkan trade dari halaman Overview atau Signals
          </p>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && summary && summary.total_trades > 0 && (
        <>
          <p className="text-[11px] text-muted-foreground">
            Angka di bawah dari jurnal trade manual, bukan pengukuran forward
            sinyal (lihat Report Card). Win rate perlu dibaca bersama rata-rata
            menang/kalah; sampel kecil tidak bermakna.
          </p>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label={`Win rate jurnal (n=${summary.win_count + summary.loss_count})`}
              value={`${summary.win_rate_pct}%`}
              sub={`${summary.win_count}W / ${summary.loss_count}L`}
            />
            <StatCard
              label="Total P&L"
              value={formatIDR(summary.total_pnl_idr)}
              sub="All time"
              trend={summary.total_pnl_idr >= 0 ? "up" : "down"}
            />
            <StatCard
              label="Daily P&L"
              value={formatIDR(summary.daily_pnl_idr)}
              sub="Today"
              trend={summary.daily_pnl_idr >= 0 ? "up" : "down"}
            />
            <StatCard
              label="Weekly P&L"
              value={formatIDR(summary.weekly_pnl_idr)}
              sub="Last 7 days"
              trend={summary.weekly_pnl_idr >= 0 ? "up" : "down"}
            />
            <StatCard
              label="Avg Win"
              value={
                summary.avg_win_idr > 0 ? formatIDR(summary.avg_win_idr) : "—"
              }
              sub={`${summary.win_count} wins`}
              trend="up"
            />
            <StatCard
              label="Avg Loss"
              value={
                summary.avg_loss_idr < 0 ? formatIDR(summary.avg_loss_idr) : "—"
              }
              sub={`${summary.loss_count} losses`}
              trend="down"
            />
            <StatCard
              label="Avg R:R"
              value={
                summary.avg_rr > 0 ? `1:${summary.avg_rr.toFixed(1)}` : "—"
              }
              sub="Closed trades"
              trend={summary.avg_rr >= 2 ? "up" : "neutral"}
            />
            <StatCard
              label="Profit Factor"
              value={
                summary.profit_factor > 0
                  ? summary.profit_factor.toFixed(2)
                  : "—"
              }
              sub={
                summary.current_streak > 0
                  ? `${summary.current_streak}× ${summary.streak_type === "win" ? "🔥 Win" : "❄️ Loss"} streak`
                  : "No streak"
              }
              trend={summary.profit_factor >= 1 ? "up" : "down"}
            />
          </div>

          {/* Win Rate per Tier */}
          <Section title={`Win Rate per Tier — ${activeLabel}`}>
            <div className="divide-y divide-border">
              {tiers.map((t) => (
                <div key={t.tier} className="flex items-center gap-4 px-5 py-3">
                  <span
                    className={cn(
                      "w-20 text-xs font-semibold shrink-0",
                      TIER_COLORS[t.tier] ?? "text-foreground",
                    )}
                  >
                    {t.tier}
                  </span>
                  <WinRateBar rate={t.win_rate} total={t.total} />
                  <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                    {t.total > 0 ? `${t.wins}/${t.total}` : "—"}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-mono w-20 text-right shrink-0",
                      t.total_pnl >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {t.total > 0 ? formatIDR(t.total_pnl) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          {/* Win Rate per Market — only when "all" */}
          {activeMarket === "all" && markets.length > 0 && (
            <Section title="Win Rate per Market">
              <div className="divide-y divide-border">
                {markets.map((m) => (
                  <div
                    key={m.market}
                    className="flex items-center gap-4 px-5 py-3"
                  >
                    <span className="w-24 text-xs font-medium text-foreground shrink-0">
                      {MARKET_LABEL[m.market] ?? m.market}
                    </span>
                    <WinRateBar rate={m.win_rate} total={m.total} />
                    <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                      {m.wins}/{m.total}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-mono w-20 text-right shrink-0",
                        m.total_pnl >= 0 ? "text-profit" : "text-loss",
                      )}
                    >
                      {formatIDR(m.total_pnl)}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Cumulative P&L */}
            <Section title={`Cumulative P&L — ${activeLabel}`}>
              {timeline.length === 0 ? (
                <div className="p-5 text-sm text-muted-foreground">
                  Belum ada closed trades
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex flex-col gap-1.5">
                    {timeline.map((point, i) => {
                      const maxAbs = Math.max(
                        ...timeline.map((p) => Math.abs(p.cumulative)),
                      );
                      const pct =
                        maxAbs > 0
                          ? (Math.abs(point.cumulative) / maxAbs) * 100
                          : 0;
                      return (
                        <div key={i} className="flex items-center gap-2.5">
                          <span className="text-[10px] text-muted-foreground w-5 text-right font-mono shrink-0">
                            {i + 1}
                          </span>
                          <span
                            className="text-[10px] text-muted-foreground w-14 shrink-0 font-mono truncate"
                            title={point.ticker}
                          >
                            {point.ticker}
                          </span>
                          <div className="flex-1 h-4 bg-secondary rounded-sm overflow-hidden flex items-center">
                            <div
                              className={cn(
                                "h-3 rounded-sm",
                                point.cumulative >= 0
                                  ? "bg-profit/50"
                                  : "bg-loss/50",
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span
                            className={cn(
                              "text-[10px] font-mono w-16 text-right shrink-0",
                              point.cumulative >= 0
                                ? "text-profit"
                                : "text-loss",
                            )}
                          >
                            {formatIDR(point.cumulative)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Final P&L
                    </span>
                    <span
                      className={cn(
                        "text-sm font-bold font-mono",
                        (timeline.at(-1)?.cumulative ?? 0) >= 0
                          ? "text-profit"
                          : "text-loss",
                      )}
                    >
                      {formatIDR(timeline.at(-1)?.cumulative ?? 0)}
                    </span>
                  </div>
                </div>
              )}
            </Section>

            {/* Monthly */}
            <Section title={`P&L Bulanan — ${activeLabel}`}>
              {monthly.length === 0 ? (
                <div className="p-5 text-sm text-muted-foreground">
                  Belum ada data bulanan
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {monthly.map((m) => (
                    <div
                      key={m.month}
                      className="flex items-center justify-between px-5 py-3"
                    >
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          {m.month}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {m.wins}/{m.trades} wins · {m.win_rate}% wr
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-sm font-bold font-mono",
                          m.pnl >= 0 ? "text-profit" : "text-loss",
                        )}
                      >
                        {formatIDR(m.pnl)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* Gate Accuracy */}
          <Section title={`Gate Accuracy — ${activeLabel}`}>
            {gates.length === 0 ? (
              <div className="p-5 text-sm text-muted-foreground">
                Butuh closed trades dengan signal terkait untuk melihat gate
                accuracy.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {gates.map((g) => (
                  <div
                    key={g.gate}
                    className="flex items-center gap-4 px-5 py-3"
                  >
                    <span className="w-48 text-xs font-mono text-foreground shrink-0">
                      {g.gate.replace(/_/g, " ")}
                    </span>
                    <WinRateBar rate={g.win_rate} total={g.trades} />
                    <span className="text-xs text-muted-foreground w-20 text-right shrink-0">
                      {g.wins}/{g.trades} trades
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Signal Accuracy */}
          {sigAcc && (
            <Section title={`Signal Accuracy — ${activeLabel}`}>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Total sinyal",
                      value: String(sigAcc.total_signals_generated),
                      color: "text-foreground",
                    },
                    {
                      label: "Dieksekusi",
                      value: String(sigAcc.signals_acted_on),
                      color: "text-primary",
                    },
                    {
                      label: "Act rate",
                      value: `${sigAcc.act_rate_pct}%`,
                      color: "text-foreground",
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-lg bg-secondary/50 p-3 text-center"
                    >
                      <p className={cn("text-xl font-bold font-mono", s.color)}>
                        {s.value}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {sigAcc.by_tier.map((t) => (
                    <div
                      key={t.tier}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <span
                        className={cn(
                          "text-xs font-semibold w-20 shrink-0",
                          TIER_COLORS[t.tier] ?? "text-foreground",
                        )}
                      >
                        {t.tier}
                      </span>
                      <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                        {t.generated} sinyal
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            TIER_BG[t.tier] ?? "bg-primary",
                          )}
                          style={{
                            width: `${t.generated > 0 ? (t.acted / t.generated) * 100 : 0}%`,
                            opacity: 0.7,
                          }}
                        />
                      </div>
                      <span className="text-xs text-foreground w-24 text-right shrink-0">
                        {t.acted} (
                        {t.generated > 0
                          ? Math.round((t.acted / t.generated) * 100)
                          : 0}
                        %)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
