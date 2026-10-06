"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatPrice, cn } from "@/lib/utils";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronUp,
  ChevronDown,
  Search,
  Activity,
  AlertCircle,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiSend } from "@/lib/api";
import { describeApiError } from "@/lib/api-error";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Recommendation {
  action: string;
  label: string;
  score: number;
  reasons: string[];
}

interface MarketRow {
  ticker: string;
  display: string;
  submarket: string;
  market: string;
  current_price: number;
  change_24h_pct: number;
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
  recommendation: Recommendation;
}

interface MarketResponse {
  rows: MarketRow[];
  summary: Record<string, number>;
  from_cache: boolean;
  cache_age_sec: number;
  total_scanned: number;
  total_success: number;
  is_stale?: boolean;
  error?: string;
}

interface MarketState {
  data: MarketResponse | null;
  loading: boolean;
  error: string | null;
}

// ── Config ────────────────────────────────────────────────────────────────────

const MARKETS = [
  { key: "stock_idx", label: "IDX", emoji: "🇮🇩" },
  { key: "stock_us", label: "US", emoji: "🇺🇸" },
  { key: "crypto", label: "Crypto", emoji: "🔷" },
  { key: "forex", label: "Forex", emoji: "💱" },
] as const;

type MarketKey = (typeof MARKETS)[number]["key"];

const ACTION_STYLE: Record<string, string> = {
  STRONG_BUY: "text-emerald-300 bg-emerald-500/15 border-emerald-500/40",
  BUY: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  WAIT: "text-muted-foreground bg-secondary border-border",
  SELL: "text-red-400 bg-red-500/10 border-red-500/25",
  STRONG_SELL: "text-red-300 bg-red-500/15 border-red-500/40",
};

const TREND_STYLE: Record<
  string,
  { icon: typeof TrendingUp; color: string; label: string }
> = {
  uptrend: { icon: TrendingUp, color: "text-emerald-400", label: "Up" },
  downtrend: { icon: TrendingDown, color: "text-red-400", label: "Down" },
  sideways: { icon: Minus, color: "text-yellow-400", label: "Side" },
  contracting: { icon: Activity, color: "text-blue-400", label: "Contract" },
  expanding: { icon: Activity, color: "text-orange-400", label: "Expand" },
  unknown: { icon: Minus, color: "text-muted-foreground", label: "?" },
};

const TIER_COLORS: Record<string, string> = {
  SNIPER: "text-emerald-400",
  PRECISION: "text-blue-400",
  STANDARD: "text-purple-400",
  SCOUT: "text-yellow-400",
  RADAR: "text-red-400",
};

const MARKET_EMOJI: Record<string, string> = {
  stock_idx: "🇮🇩",
  stock_us: "🇺🇸",
  crypto: "🔷",
  forex: "💱",
};

type SortKey =
  | "ticker"
  | "trend"
  | "rsi"
  | "change"
  | "volume"
  | "recommendation"
  | "signal"
  | "sentiment";

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p
        className={cn(
          "text-base font-bold font-mono mt-0.5",
          color ?? "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function MarketStatusPill({
  market,
  state,
}: {
  market: (typeof MARKETS)[number];
  state: MarketState;
}) {
  const isLoading = state.loading && !state.data;
  const hasData = !!state.data && state.data.rows.length > 0;
  const isStale = state.data?.is_stale;
  const isCached = state.data?.from_cache;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] border",
        isLoading
          ? "border-blue-500/30 bg-blue-500/5 text-blue-400"
          : hasData && isStale
            ? "border-orange-500/30 bg-orange-500/5 text-orange-400"
            : hasData
              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
              : "border-border bg-secondary text-muted-foreground",
      )}
    >
      <span>{market.emoji}</span>
      <span className="font-medium">{market.label}</span>
      {isLoading && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
      {hasData && !isLoading && (
        <span className="font-mono opacity-70">
          {state.data?.total_success}
          {isCached && state.data?.cache_age_sec
            ? ` · ${Math.floor(state.data.cache_age_sec / 60)}m`
            : ""}
        </span>
      )}
    </div>
  );
}

function TrendBadge({ trend, pattern }: { trend: string; pattern: string }) {
  const s = TREND_STYLE[trend] ?? TREND_STYLE.unknown;
  const Icon = s.icon;
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn("w-3 h-3", s.color)} />
      <div className="min-w-0">
        <p className={cn("text-[11px] font-semibold", s.color)}>{s.label}</p>
        <p className="text-[9px] text-muted-foreground font-mono">{pattern}</p>
      </div>
    </div>
  );
}

function RSIPill({ rsi }: { rsi: number }) {
  const c =
    rsi >= 70
      ? "text-red-400 bg-red-500/10 border-red-500/20"
      : rsi <= 30
        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
        : "text-muted-foreground bg-secondary border-border";
  return (
    <span
      className={cn("text-[10px] px-1.5 py-0.5 rounded border font-mono", c)}
    >
      {rsi.toFixed(0)}
    </span>
  );
}

function VolumeIndicator({ status, ratio }: { status: string; ratio: number }) {
  const c =
    status === "spike"
      ? "text-orange-400"
      : status === "above_avg"
        ? "text-emerald-400"
        : status === "below_avg"
          ? "text-muted-foreground/60"
          : "text-muted-foreground";
  const i =
    status === "spike"
      ? "⚡"
      : status === "above_avg"
        ? "↑"
        : status === "below_avg"
          ? "↓"
          : "·";
  return (
    <span className={cn("text-[11px] font-mono flex items-center gap-1", c)}>
      {i} {ratio.toFixed(1)}x
    </span>
  );
}

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onClick,
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  onClick: (k: SortKey) => void;
  className?: string;
}) {
  const active = current === sortKey;
  return (
    <button
      onClick={() => onClick(sortKey)}
      className={cn(
        "flex items-center gap-1 text-left hover:text-foreground transition-colors",
        active && "text-foreground",
        className,
      )}
    >
      {label}
      {active &&
        (dir === "asc" ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        ))}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MarketContent() {
  const router = useRouter();

  // Independent state per market (progressive loading)
  const [marketStates, setMarketStates] = useState<
    Record<MarketKey, MarketState>
  >({
    stock_idx: { data: null, loading: false, error: null },
    stock_us: { data: null, loading: false, error: null },
    crypto: { data: null, loading: false, error: null },
    forex: { data: null, loading: false, error: null },
  });

  const [activeFilter, setActiveFilter] = useState<MarketKey | "all">("all");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("recommendation");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [prewarming, setPrewarming] = useState(false);

  const loadingRef = useRef<Set<MarketKey>>(new Set());

  // Load one market (cache first, never refresh from frontend auto)
  const loadMarket = useCallback(
    async (key: MarketKey, forceRefresh = false) => {
      if (loadingRef.current.has(key)) return;
      loadingRef.current.add(key);
      setMarketStates((s) => ({
        ...s,
        [key]: { ...s[key], loading: true, error: null },
      }));

      try {
        const data = await apiGet<MarketResponse>(
          `/market/overview/${key}${forceRefresh ? "?refresh=true" : ""}`,
        );
        setMarketStates((s) => ({
          ...s,
          [key]: { data, loading: false, error: data.error ?? null },
        }));
      } catch (e) {
        const d = describeApiError(e, `memuat ${key}`);
        setMarketStates((s) => ({
          ...s,
          [key]: {
            ...s[key],
            loading: false,
            error: `${d.title}. ${d.description}`,
          },
        }));
      } finally {
        loadingRef.current.delete(key);
      }
    },
    [],
  );

  // Initial: hanya load dari disk cache (tidak trigger fetch baru)
  // User harus klik "Load" untuk fetch fresh data per market
  useEffect(() => {
    const keys: MarketKey[] = ["stock_idx", "stock_us", "crypto", "forex"];
    // Load satu per satu dengan delay BESAR (1 detik) — hanya baca cache
    // Kalau cache ada, instant. Kalau tidak ada, akan empty dan user bisa click load
    keys.forEach((k, i) => setTimeout(() => loadMarket(k), i * 1000));
  }, [loadMarket]);

  // Pre-warm all markets in background
  const handlePrewarm = async () => {
    setPrewarming(true);
    try {
      await apiSend("POST", "/market/prewarm");
      // Poll cache status every 5s, refresh markets as they become available
      const startTime = Date.now();
      const poll = async () => {
        if (Date.now() - startTime > 180000) {
          setPrewarming(false);
          return;
        } // 3 min max
        await Promise.all(MARKETS.map((m) => loadMarket(m.key)));
        const allFresh = Object.values(marketStates).every(
          (s) => s.data && !s.data.from_cache,
        );
        if (allFresh) {
          setPrewarming(false);
          return;
        }
        setTimeout(poll, 5000);
      };
      setTimeout(poll, 3000);
    } catch (e) {
      const d = describeApiError(e, "memanaskan cache market");
      toast.error(d.title, { description: [d.description, d.hint].filter(Boolean).join(" ") });
      setPrewarming(false);
    }
  };

  // Refresh one market
  const handleRefreshMarket = (key: MarketKey) => loadMarket(key, true);

  // Combine all rows + filter + sort
  const allRows = useMemo(() => {
    const rows: MarketRow[] = [];
    const keys: MarketKey[] =
      activeFilter === "all"
        ? ["stock_idx", "stock_us", "crypto", "forex"]
        : [activeFilter];
    for (const k of keys) {
      if (marketStates[k].data?.rows) rows.push(...marketStates[k].data.rows);
    }
    return rows;
  }, [marketStates, activeFilter]);

  const filteredRows = useMemo(() => {
    let rows = [...allRows];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.ticker.toLowerCase().includes(q) ||
          r.display.toLowerCase().includes(q),
      );
    }
    if (actionFilter !== "all") {
      rows = rows.filter((r) => r.recommendation.action === actionFilter);
    }
    rows.sort((a, b) => {
      let av = 0,
        bv = 0;
      switch (sortKey) {
        case "ticker":
          return sortDir === "asc"
            ? a.ticker.localeCompare(b.ticker)
            : b.ticker.localeCompare(a.ticker);
        case "trend":
          av = a.trend_strength;
          bv = b.trend_strength;
          break;
        case "rsi":
          av = a.rsi;
          bv = b.rsi;
          break;
        case "change":
          av = a.change_24h_pct;
          bv = b.change_24h_pct;
          break;
        case "volume":
          av = a.volume_ratio;
          bv = b.volume_ratio;
          break;
        case "recommendation":
          av = a.recommendation.score;
          bv = b.recommendation.score;
          break;
        case "signal":
          av = a.has_signal ? 1 : 0;
          bv = b.has_signal ? 1 : 0;
          break;
        case "sentiment":
          av = a.sentiment_score ?? 0;
          bv = b.sentiment_score ?? 0;
          break;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [allRows, search, actionFilter, sortKey, sortDir]);

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const handleRowClick = (row: MarketRow) => {
    router.push(`/market/${row.market}/${encodeURIComponent(row.ticker)}`);
  };

  // Aggregate summary
  const summary = useMemo(() => {
    return {
      total: allRows.length,
      uptrend: allRows.filter((r) => r.trend === "uptrend").length,
      downtrend: allRows.filter((r) => r.trend === "downtrend").length,
      sideways: allRows.filter((r) =>
        ["sideways", "contracting", "expanding"].includes(r.trend),
      ).length,
      with_signal: allRows.filter((r) => r.has_signal).length,
      strong_buy: allRows.filter(
        (r) => r.recommendation.action === "STRONG_BUY",
      ).length,
      buy: allRows.filter((r) => r.recommendation.action === "BUY").length,
      wait: allRows.filter((r) => r.recommendation.action === "WAIT").length,
      sell: allRows.filter((r) =>
        ["SELL", "STRONG_SELL"].includes(r.recommendation.action),
      ).length,
    };
  }, [allRows]);

  const anyLoading = Object.values(marketStates).some((s) => s.loading);
  const allLoaded = Object.values(marketStates).every((s) => s.data !== null);
  const totalScanned = allRows.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-foreground">
            Market Overview
          </h1>
          <p className="text-xs text-muted-foreground">
            {totalScanned > 0
              ? `${totalScanned} tickers loaded`
              : "Loading markets..."}
            {anyLoading && " · scanning..."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrewarm}
            disabled={prewarming}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-orange-500/30 bg-orange-500/5 text-orange-400 hover:bg-orange-500/10 disabled:opacity-50 transition-all"
          >
            <Flame
              className={cn("w-3.5 h-3.5", prewarming && "animate-pulse")}
            />
            {prewarming ? "Refreshing..." : "Refresh All"}
          </button>
        </div>
      </div>

      {/* Market status pills */}
      <div className="flex flex-wrap items-center gap-2">
        {MARKETS.map((m) => (
          <MarketStatusPill
            key={m.key}
            market={m}
            state={marketStates[m.key]}
          />
        ))}
        {allLoaded && (
          <span className="text-[10px] text-emerald-400 flex items-center gap-1 ml-auto">
            <CheckCircle2 className="w-3 h-3" /> All loaded
          </span>
        )}
      </div>

      {/* Summary cards */}
      {totalScanned > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <StatCard
            label="Up"
            value={summary.uptrend}
            color="text-emerald-400"
          />
          <StatCard
            label="Down"
            value={summary.downtrend}
            color="text-red-400"
          />
          <StatCard
            label="Side"
            value={summary.sideways}
            color="text-yellow-400"
          />
          <StatCard
            label="Signals"
            value={summary.with_signal}
            color="text-primary"
          />
          <StatCard
            label="Str.Buy"
            value={summary.strong_buy}
            color="text-emerald-300"
          />
          <StatCard label="Buy" value={summary.buy} color="text-emerald-400" />
          <StatCard
            label="Wait"
            value={summary.wait}
            color="text-muted-foreground"
          />
          <StatCard label="Sell" value={summary.sell} color="text-red-400" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveFilter("all")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
              activeFilter === "all"
                ? "bg-primary/15 text-primary border-primary/25"
                : "text-muted-foreground border-border hover:text-foreground",
            )}
          >
            🌐 All
          </button>
          {MARKETS.map((m) => (
            <button
              key={m.key}
              onClick={() => setActiveFilter(m.key)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
                activeFilter === m.key
                  ? "bg-primary/15 text-primary border-primary/25"
                  : "text-muted-foreground border-border hover:text-foreground",
              )}
            >
              {m.emoji} {m.label}
            </button>
          ))}
        </div>

        {activeFilter !== "all" && (
          <button
            onClick={() => handleRefreshMarket(activeFilter)}
            disabled={marketStates[activeFilter].loading}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 transition-all"
          >
            <RefreshCw
              className={cn(
                "w-3 h-3",
                marketStates[activeFilter].loading && "animate-spin",
              )}
            />
            Refresh {MARKETS.find((m) => m.key === activeFilter)?.label}
          </button>
        )}

        <div className="flex gap-1 ml-auto">
          {["all", "STRONG_BUY", "BUY", "WAIT", "SELL"].map((o) => (
            <button
              key={o}
              onClick={() => setActionFilter(o)}
              className={cn(
                "px-2 py-1 rounded-lg text-[10px] border transition-all whitespace-nowrap",
                actionFilter === o
                  ? "bg-primary/15 text-primary border-primary/25"
                  : "text-muted-foreground border-border hover:text-foreground",
              )}
            >
              {o === "all" ? "All" : o.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-32 max-w-48">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-lg border border-border bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      {/* Errors per market */}
      {Object.entries(marketStates)
        .filter(([, s]) => s.error)
        .map(([k, s]) => (
          <div
            key={k}
            className="flex items-start gap-3 px-3 py-2 rounded-lg border border-destructive/20 bg-destructive/5 text-xs text-destructive"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              <strong>{MARKETS.find((m) => m.key === k)?.label}:</strong>{" "}
              {s.error}
            </span>
          </div>
        ))}

      {/* Table */}
      {totalScanned > 0 ? (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-xs min-w-[1100px]">
            <thead>
              <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-3 py-2.5 w-[120px]">
                  <SortHeader
                    label="Ticker"
                    sortKey="ticker"
                    current={sortKey}
                    dir={sortDir}
                    onClick={handleSort}
                  />
                </th>
                <th className="text-left px-3 py-2.5 w-[100px]">
                  <SortHeader
                    label="Trend"
                    sortKey="trend"
                    current={sortKey}
                    dir={sortDir}
                    onClick={handleSort}
                  />
                </th>
                <th className="text-right px-3 py-2.5 w-[90px]">Price</th>
                <th className="text-right px-3 py-2.5 w-[70px]">
                  <SortHeader
                    label="24h%"
                    sortKey="change"
                    current={sortKey}
                    dir={sortDir}
                    onClick={handleSort}
                    className="ml-auto"
                  />
                </th>
                <th className="text-center px-3 py-2.5 w-[55px]">
                  <SortHeader
                    label="RSI"
                    sortKey="rsi"
                    current={sortKey}
                    dir={sortDir}
                    onClick={handleSort}
                    className="mx-auto"
                  />
                </th>
                <th className="text-center px-3 py-2.5 w-[65px]">
                  <SortHeader
                    label="Vol"
                    sortKey="volume"
                    current={sortKey}
                    dir={sortDir}
                    onClick={handleSort}
                    className="mx-auto"
                  />
                </th>
                <th className="text-left px-3 py-2.5 w-[140px]">S / R</th>
                <th className="text-center px-3 py-2.5 w-[80px]">
                  <SortHeader
                    label="Signal"
                    sortKey="signal"
                    current={sortKey}
                    dir={sortDir}
                    onClick={handleSort}
                    className="mx-auto"
                  />
                </th>
                <th className="text-center px-3 py-2.5 w-[85px]">
                  <SortHeader
                    label="Sentiment"
                    sortKey="sentiment"
                    current={sortKey}
                    dir={sortDir}
                    onClick={handleSort}
                    className="mx-auto"
                  />
                </th>
                <th className="text-left px-3 py-2.5 min-w-[160px]">
                  <SortHeader
                    label="Recommendation"
                    sortKey="recommendation"
                    current={sortKey}
                    dir={sortDir}
                    onClick={handleSort}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
                <tr
                  key={row.ticker + idx}
                  onClick={() => handleRowClick(row)}
                  className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm shrink-0">
                        {MARKET_EMOJI[row.market]}
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-foreground">
                          {row.display}
                        </p>
                        <p className="text-[9px] text-muted-foreground">
                          {row.submarket}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <TrendBadge
                      trend={row.trend}
                      pattern={row.structure_pattern}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <p className="font-mono text-foreground">
                      {formatPrice(row.current_price, row.market)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {row.ma_position === "above"
                        ? "↑"
                        : row.ma_position === "below"
                          ? "↓"
                          : "·"}{" "}
                      MA50
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={cn(
                        "font-mono font-medium",
                        row.change_24h_pct > 0.5
                          ? "text-emerald-400"
                          : row.change_24h_pct < -0.5
                            ? "text-red-400"
                            : "text-muted-foreground",
                      )}
                    >
                      {row.change_24h_pct > 0 ? "+" : ""}
                      {row.change_24h_pct.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <RSIPill rsi={row.rsi} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <VolumeIndicator
                      status={row.volume_status}
                      ratio={row.volume_ratio}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-[10px] font-mono leading-tight">
                      <p className="text-red-400">
                        R:{" "}
                        {row.resistance
                          ? formatPrice(row.resistance, row.market)
                          : "—"}
                        {row.resistance_dist_pct !== null && (
                          <span className="text-muted-foreground/60 ml-1">
                            +{row.resistance_dist_pct.toFixed(1)}%
                          </span>
                        )}
                      </p>
                      <p className="text-emerald-400 mt-0.5">
                        S:{" "}
                        {row.support
                          ? formatPrice(row.support, row.market)
                          : "—"}
                        {row.support_dist_pct !== null && (
                          <span className="text-muted-foreground/60 ml-1">
                            -{row.support_dist_pct.toFixed(1)}%
                          </span>
                        )}
                      </p>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {row.has_signal && row.signal_tier ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={cn(
                            "text-[9px] font-bold px-1.5 py-0.5 rounded border",
                            TIER_COLORS[row.signal_tier],
                            "border-current/20",
                          )}
                        >
                          {row.signal_tier}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {row.signal_action}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[10px]">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {row.sentiment_label ? (
                      <span
                        className={cn(
                          "text-[9px] font-medium",
                          row.sentiment_label.includes("BULLISH")
                            ? "text-emerald-400"
                            : row.sentiment_label.includes("BEARISH")
                              ? "text-red-400"
                              : "text-muted-foreground",
                        )}
                      >
                        {row.sentiment_label
                          .replace("STRONG_", "⚡")
                          .replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[10px]">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[10px] font-bold px-2 py-1 rounded-md border whitespace-nowrap",
                          ACTION_STYLE[row.recommendation.action] ??
                            ACTION_STYLE.WAIT,
                        )}
                      >
                        {row.recommendation.label}
                      </span>
                      {row.recommendation.reasons[0] && (
                        <span className="text-[9px] text-muted-foreground line-clamp-1">
                          {row.recommendation.reasons[0]}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : anyLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg border border-border shimmer"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl">
          <Search className="w-8 h-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Tidak ada data tersedia
          </p>
          <button
            onClick={handlePrewarm}
            className="mt-3 text-xs text-primary hover:underline"
          >
            Mulai scan markets
          </button>
        </div>
      )}

      {totalScanned > 0 && (
        <div className="rounded-xl border border-border bg-secondary/30 p-3 text-[11px] text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">💡 Tips Performance:</p>
          <p>
            · Data di-cache 10 menit untuk hemat resource. Tombol &ldquo;Refresh
            All&rdquo; untuk force scan ulang.
          </p>
          <p>
            · Pilih filter market satu per satu (IDX, US, dll) kalau ingin lebih
            ringan.
          </p>
          <p>· Klik baris untuk lihat chart detail dan analisis lengkap.</p>
        </div>
      )}
    </div>
  );
}
