"use client";

import { useState, useEffect, useCallback } from "react";
import { formatIDR, cn, timeAgo } from "@/lib/utils";
import {
  RefreshCw,
  BookOpen,
  TrendingUp,
  Target,
  Clock,
  ChevronDown,
  ChevronUp,
  Edit3,
  Check,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface JournalEntry {
  id: number;
  trade_id: number;
  signal_id: number | null;
  ticker: string;
  market: string;
  tier: string;
  direction: string;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number;
  take_profit: number;
  units: number;
  pnl_idr: number | null;
  risk_idr: number;
  r_multiple: number | null;
  outcome: string;
  outcome_label: string;
  r_label: string;
  opened_at: string;
  closed_at: string | null;
  holding_hours: number | null;
  holding_days: number | null;
  confidence: number;
  gates_pass_count: number;
  gates_passed: string[];
  gates_failed: string[];
  wyckoff_phase: string | null;
  setup_type: string | null;
  entry_reason: string;
  exit_reason: string;
  pre_trade_note: string;
  post_trade_note: string;
  market_condition: string | null;
}

interface TierWinRate {
  tier: string;
  total: number;
  wins: number;
  losses: number;
  win_rate: number | null;
  total_pnl: number;
  avg_r: number;
  expectancy: number;
}

interface SetupStat {
  setup_type: string;
  total: number;
  wins: number;
  win_rate: number;
  avg_r: number;
  avg_hold_h: number;
  total_pnl: number;
}

interface HoldingBucket {
  bucket: string;
  total: number;
  wins: number;
  win_rate: number;
  total_pnl: number;
  avg_hold_h: number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const MARKET_FILTERS = [
  { value: "all", label: "All", emoji: "🌐" },
  { value: "stock", label: "Stock", emoji: "📈" },
  { value: "stock_idx", label: "IDX", emoji: "🇮🇩" },
  { value: "stock_us", label: "US", emoji: "🇺🇸" },
  { value: "crypto", label: "Crypto", emoji: "🔷" },
  { value: "forex", label: "Forex", emoji: "💱" },
];

const OUTCOME_FILTERS = [
  { value: "all", label: "All" },
  { value: "win", label: "Win" },
  { value: "loss", label: "Loss" },
  { value: "breakeven", label: "Even" },
];

const TIER_COLORS: Record<string, string> = {
  SNIPER: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  PRECISION: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  STANDARD: "text-purple-400 border-purple-400/30 bg-purple-400/10",
  SCOUT: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  RADAR: "text-red-400 border-red-400/30 bg-red-400/10",
};

const OUTCOME_STYLE: Record<string, string> = {
  win: "text-profit bg-profit/10 border-profit/20",
  loss: "text-loss bg-loss/10 border-loss/20",
  breakeven: "text-muted-foreground bg-secondary border-border",
  open: "text-primary bg-primary/10 border-primary/20",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function WinRateBar({ rate, total }: { rate: number | null; total: number }) {
  if (!rate || total === 0)
    return <span className="text-xs text-muted-foreground">—</span>;
  const color =
    rate >= 65 ? "bg-emerald-500" : rate >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${rate}%` }}
        />
      </div>
      <span
        className={cn(
          "text-xs font-mono font-semibold w-9 text-right shrink-0",
          rate >= 65
            ? "text-profit"
            : rate >= 50
              ? "text-warning"
              : "text-loss",
        )}
      >
        {rate}%
      </span>
    </div>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Journal Entry Card ────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onNoteUpdate,
}: {
  entry: JournalEntry;
  onNoteUpdate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(entry.post_trade_note || "");
  const [saving, setSaving] = useState(false);

  const saveNote = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/journal/${entry.id}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_trade_note: note }),
      });
      setEditing(false);
      onNoteUpdate();
    } finally {
      setSaving(false);
    }
  };

  const holdingLabel =
    entry.holding_hours !== null
      ? entry.holding_hours < 24
        ? `${entry.holding_hours.toFixed(1)}h`
        : `${entry.holding_days?.toFixed(1)}d`
      : "—";

  return (
    <div
      className={cn(
        "border-b border-border last:border-0",
        entry.outcome === "win"
          ? "border-l-2 border-l-profit/50"
          : entry.outcome === "loss"
            ? "border-l-2 border-l-loss/50"
            : "",
      )}
    >
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 cursor-pointer transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Tier */}
        <span
          className={cn(
            "text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0",
            TIER_COLORS[entry.tier] ?? "text-muted-foreground",
          )}
        >
          {entry.tier}
        </span>

        {/* Ticker */}
        <div className="w-24 shrink-0">
          <p className="text-xs font-semibold text-foreground font-mono">
            {entry.ticker}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {entry.setup_type?.replace(/_/g, " ")}
          </p>
        </div>

        {/* Outcome + R */}
        <div className="w-24 shrink-0">
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded-md border",
              OUTCOME_STYLE[entry.outcome] ?? OUTCOME_STYLE.open,
            )}
          >
            {entry.outcome_label}
          </span>
          <p
            className={cn(
              "text-xs font-mono font-semibold mt-0.5",
              (entry.r_multiple ?? 0) > 0
                ? "text-profit"
                : (entry.r_multiple ?? 0) < 0
                  ? "text-loss"
                  : "text-muted-foreground",
            )}
          >
            {entry.r_label}
          </p>
        </div>

        {/* P&L */}
        <div className="w-20 shrink-0 text-right">
          <span
            className={cn(
              "text-xs font-mono font-semibold",
              (entry.pnl_idr ?? 0) >= 0 ? "text-profit" : "text-loss",
            )}
          >
            {entry.pnl_idr !== null ? formatIDR(entry.pnl_idr) : "—"}
          </span>
        </div>

        {/* Holding */}
        <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground w-12 shrink-0">
          <Clock className="w-3 h-3" />
          {holdingLabel}
        </div>

        {/* Gates */}
        <div className="hidden md:block text-[10px] text-muted-foreground w-20 shrink-0">
          {entry.gates_pass_count} gates · {entry.confidence}%
        </div>

        {/* Time */}
        <div className="hidden lg:block text-[10px] text-muted-foreground ml-auto shrink-0">
          {timeAgo(entry.opened_at)}
        </div>

        {/* Expand */}
        <div className="ml-auto shrink-0">
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 bg-secondary/10">
          {/* Price levels */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            {[
              {
                label: "Entry",
                value: entry.entry_price.toFixed(5),
                color: "text-foreground",
              },
              {
                label: "Stop Loss",
                value: entry.stop_loss.toFixed(5),
                color: "text-loss",
              },
              {
                label: "Take Profit",
                value: entry.take_profit.toFixed(5),
                color: "text-profit",
              },
            ].map((l) => (
              <div
                key={l.label}
                className="rounded-lg bg-secondary p-2 text-center"
              >
                <p className={cn("text-xs font-mono font-semibold", l.color)}>
                  {l.value}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {l.label}
                </p>
              </div>
            ))}
          </div>

          {/* Detail grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            {[
              {
                k: "Exit Reason",
                v: entry.exit_reason?.replace(/_/g, " ") || "—",
              },
              { k: "Holding", v: holdingLabel },
              { k: "Market Cond.", v: entry.market_condition || "—" },
              { k: "Wyckoff", v: entry.wyckoff_phase || "—" },
            ].map(({ k, v }) => (
              <div key={k}>
                <p className="text-muted-foreground text-[10px]">{k}</p>
                <p className="text-foreground font-medium">{v}</p>
              </div>
            ))}
          </div>

          {/* Gates */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Gates Passed
            </p>
            <div className="flex flex-wrap gap-1">
              {(Array.isArray(entry.gates_passed)
                ? entry.gates_passed
                : []
              ).map((g) => (
                <span
                  key={g}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-profit/10 text-profit border border-profit/15 font-mono"
                >
                  {g.replace(/_/g, " ")}
                </span>
              ))}
              {(Array.isArray(entry.gates_failed)
                ? entry.gates_failed
                : []
              ).map((g) => (
                <span
                  key={g}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-loss/5 text-loss/60 border border-loss/10 font-mono"
                >
                  {g.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>

          {/* Entry reason */}
          {entry.entry_reason && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Entry Reason
              </p>
              <p className="text-xs text-foreground">{entry.entry_reason}</p>
            </div>
          )}

          {/* Post-trade note */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Refleksi / Catatan
              </p>
              {!editing ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                  }}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    saveNote();
                  }}
                  disabled={saving}
                  className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  <Check className="w-3 h-3" /> {saving ? "Saving..." : "Save"}
                </button>
              )}
            </div>
            {editing ? (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Apa yang bisa dipelajari dari trade ini? Kenapa win/loss? Apa yang akan kamu lakukan berbeda?"
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
                rows={3}
              />
            ) : (
              <p className="text-xs text-foreground/80 italic">
                {entry.post_trade_note || (
                  <span className="text-muted-foreground">
                    Belum ada catatan — klik Edit untuk tambah refleksi
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function JournalContent() {
  const [market, setMarket] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [tiers, setTiers] = useState<TierWinRate[]>([]);
  const [setups, setSetups] = useState<SetupStat[]>([]);
  const [holding, setHolding] = useState<HoldingBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<"journal" | "winrate" | "setup" | "holding">(
    "journal",
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const mq = market !== "all" ? `?market=${market}` : "";
      const [j, wr, su, ho] = await Promise.all([
        fetch(
          `${API}/journal?market=${market}&outcome=${outcome}&limit=100`,
        ).then((r) => r.json()),
        fetch(`${API}/journal/winrate/by-tier${mq}`).then((r) => r.json()),
        fetch(`${API}/journal/stats/setup-analysis${mq}`).then((r) => r.json()),
        fetch(`${API}/journal/stats/holding-analysis${mq}`).then((r) =>
          r.json(),
        ),
      ]);
      setEntries(j.entries ?? []);
      setTiers(wr.tiers ?? []);
      setSetups(su.setups ?? []);
      setHolding(ho.buckets ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [market, outcome]);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await fetch(`${API}/journal/sync`, { method: "POST" }).then(
        (r) => r.json(),
      );
      if (r.synced > 0) await load();
    } finally {
      setSyncing(false);
    }
  };

  // Summary stats dari entries
  const closed = entries.filter((e) => e.outcome !== "open");
  const wins = closed.filter((e) => e.outcome === "win");
  const winRate =
    closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0;
  const totalPnl = closed.reduce((a, b) => a + (b.pnl_idr ?? 0), 0);

  const VIEWS = [
    { id: "journal", label: "Journal", icon: BookOpen },
    { id: "winrate", label: "Win Rate Tracker", icon: Target },
    { id: "setup", label: "Setup Analysis", icon: TrendingUp },
    { id: "holding", label: "Holding Analysis", icon: Clock },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Filters + sync */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {MARKET_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setMarket(f.value)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
                market === f.value
                  ? "bg-primary/15 text-primary border-primary/25"
                  : "text-muted-foreground border-border hover:text-foreground",
              )}
            >
              {f.emoji} {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
          {syncing ? "Syncing..." : "Sync Journal"}
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Journal Entries",
            value: String(entries.length),
            color: "text-foreground",
          },
          {
            label: "Win Rate",
            value: closed.length ? `${winRate}%` : "—",
            color: winRate >= 50 ? "text-profit" : "text-loss",
          },
          {
            label: "Total P&L",
            value: formatIDR(totalPnl),
            color: totalPnl >= 0 ? "text-profit" : "text-loss",
          },
          {
            label: "Open Positions",
            value: String(entries.filter((e) => e.outcome === "open").length),
            color: "text-primary",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={cn("text-xl font-bold font-mono", s.color)}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* View switcher */}
      <div className="flex gap-1.5 border-b border-border pb-3">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              view === id
                ? "bg-primary/15 text-primary border-primary/25"
                : "text-muted-foreground border-transparent hover:text-foreground",
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl border border-border shimmer"
            />
          ))}
        </div>
      ) : (
        <>
          {/* ── JOURNAL VIEW ────────────────────────────────────────────── */}
          {view === "journal" && (
            <div className="space-y-3">
              {/* Outcome filter */}
              <div className="flex gap-1.5">
                {OUTCOME_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setOutcome(f.value)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-lg border transition-all",
                      outcome === f.value
                        ? "bg-primary/15 text-primary border-primary/25"
                        : "text-muted-foreground border-border",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
                <span className="ml-auto text-xs text-muted-foreground self-center">
                  {entries.length} entries
                </span>
              </div>

              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl">
                  <BookOpen className="w-8 h-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Belum ada journal entries
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Journal dibuat otomatis saat trade ditutup. Klik "Sync
                    Journal" untuk sinkronisasi trades lama.
                  </p>
                </div>
              ) : (
                <Section title="Trading Journal">
                  {/* Header */}
                  <div className="grid grid-cols-[80px_96px_96px_80px_52px_80px_1fr] gap-px bg-border text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {[
                      "Tier",
                      "Ticker",
                      "Outcome",
                      "P&L",
                      "Hold",
                      "Gates",
                      "",
                    ].map((h, i) => (
                      <div key={i} className="bg-card px-4 py-2">
                        {h}
                      </div>
                    ))}
                  </div>
                  {entries.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      onNoteUpdate={load}
                    />
                  ))}
                </Section>
              )}
            </div>
          )}

          {/* ── WIN RATE TRACKER ────────────────────────────────────────── */}
          {view === "winrate" && (
            <div className="space-y-4">
              <Section title="Win Rate per Tier — Live dari Journal">
                <div className="divide-y divide-border">
                  {tiers.map((t) => (
                    <div
                      key={t.tier}
                      className="flex items-center gap-4 px-5 py-4"
                    >
                      <span
                        className={cn(
                          "w-20 text-xs font-bold shrink-0 px-2 py-0.5 rounded-md border text-center",
                          TIER_COLORS[t.tier] ?? "text-muted-foreground",
                        )}
                      >
                        {t.tier}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <WinRateBar rate={t.win_rate} total={t.total} />
                          <span className="text-xs text-muted-foreground shrink-0 w-12 text-right">
                            {t.total > 0 ? `${t.wins}/${t.total}` : "—"}
                          </span>
                        </div>
                        <div className="flex gap-4 text-[10px] text-muted-foreground">
                          <span>
                            Avg R:{" "}
                            <span
                              className={cn(
                                "font-mono font-medium",
                                t.avg_r > 0
                                  ? "text-profit"
                                  : t.avg_r < 0
                                    ? "text-loss"
                                    : "text-foreground",
                              )}
                            >
                              {t.avg_r > 0 ? "+" : ""}
                              {t.avg_r}
                            </span>
                          </span>
                          <span>
                            Expectancy:{" "}
                            <span
                              className={cn(
                                "font-mono font-medium",
                                t.expectancy > 0 ? "text-profit" : "text-loss",
                              )}
                            >
                              {t.expectancy > 0 ? "+" : ""}
                              {t.expectancy}R
                            </span>
                          </span>
                          <span>
                            P&L:{" "}
                            <span
                              className={cn(
                                "font-mono font-medium",
                                t.total_pnl >= 0 ? "text-profit" : "text-loss",
                              )}
                            >
                              {formatIDR(t.total_pnl)}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Expectancy explanation */}
              <div className="px-4 py-3 rounded-xl border border-border bg-secondary/30 text-xs text-muted-foreground">
                <strong className="text-foreground">Expectancy</strong> = (Win%
                × Avg Win R) − (Loss% × Avg Loss R). Nilai positif berarti
                sistem profitable jangka panjang. Target: &gt; +0.5R per trade.
              </div>
            </div>
          )}

          {/* ── SETUP ANALYSIS ──────────────────────────────────────────── */}
          {view === "setup" && (
            <Section title="Setup Analysis — Mana yang Paling Profitable?">
              {setups.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  Butuh lebih banyak closed trades untuk analisis setup.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  <div className="grid grid-cols-[1fr_60px_60px_70px_60px_80px] gap-px bg-border text-[10px] font-medium text-muted-foreground uppercase">
                    {[
                      "Setup Type",
                      "Total",
                      "Win%",
                      "Avg R",
                      "Hold",
                      "P&L",
                    ].map((h, i) => (
                      <div key={i} className="bg-card px-4 py-2">
                        {h}
                      </div>
                    ))}
                  </div>
                  {setups.map((s) => (
                    <div
                      key={s.setup_type}
                      className="grid grid-cols-[1fr_60px_60px_70px_60px_80px] gap-px bg-border"
                    >
                      <div className="bg-card px-4 py-3">
                        <p className="text-xs font-medium text-foreground">
                          {s.setup_type?.replace(/_/g, " ")}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {s.wins}/{s.total} wins
                        </p>
                      </div>
                      <div className="bg-card px-3 py-3 flex items-center text-xs font-mono text-foreground">
                        {s.total}
                      </div>
                      <div className="bg-card px-3 py-3 flex items-center">
                        <span
                          className={cn(
                            "text-xs font-mono font-semibold",
                            s.win_rate >= 65
                              ? "text-profit"
                              : s.win_rate >= 50
                                ? "text-warning"
                                : "text-loss",
                          )}
                        >
                          {s.win_rate}%
                        </span>
                      </div>
                      <div className="bg-card px-3 py-3 flex items-center">
                        <span
                          className={cn(
                            "text-xs font-mono",
                            s.avg_r > 0 ? "text-profit" : "text-loss",
                          )}
                        >
                          {s.avg_r > 0 ? "+" : ""}
                          {s.avg_r}R
                        </span>
                      </div>
                      <div className="bg-card px-3 py-3 flex items-center text-xs font-mono text-muted-foreground">
                        {s.avg_hold_h < 24
                          ? `${s.avg_hold_h}h`
                          : `${(s.avg_hold_h / 24).toFixed(1)}d`}
                      </div>
                      <div className="bg-card px-3 py-3 flex items-center">
                        <span
                          className={cn(
                            "text-xs font-mono",
                            s.total_pnl >= 0 ? "text-profit" : "text-loss",
                          )}
                        >
                          {formatIDR(s.total_pnl)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* ── HOLDING ANALYSIS ────────────────────────────────────────── */}
          {view === "holding" && (
            <div className="space-y-4">
              <Section title="Holding Duration Analysis">
                {holding.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground text-center">
                    Butuh lebih banyak closed trades untuk analisis ini.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {holding.map((h) => (
                      <div
                        key={h.bucket}
                        className="flex items-center gap-4 px-5 py-4"
                      >
                        <div className="w-36 shrink-0">
                          <p className="text-xs font-semibold text-foreground">
                            {h.bucket}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            avg {h.avg_hold_h}h · {h.wins}/{h.total} wins
                          </p>
                        </div>
                        <WinRateBar rate={h.win_rate} total={h.total} />
                        <span
                          className={cn(
                            "text-xs font-mono font-semibold w-20 text-right shrink-0",
                            h.total_pnl >= 0 ? "text-profit" : "text-loss",
                          )}
                        >
                          {formatIDR(h.total_pnl)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
              <div className="px-4 py-3 rounded-xl border border-border bg-secondary/30 text-xs text-muted-foreground">
                Analisis ini membantu kamu tahu apakah exit lebih awal (scalp)
                atau hold lebih lama (swing) lebih cocok dengan strategi kamu.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
