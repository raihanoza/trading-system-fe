"use client";

import { useState } from "react";
import { useTrades } from "@/hooks/useTrades";
import { formatIDR, formatPrice, timeAgo, cn } from "@/lib/utils";
import type { Trade } from "@/types";
import CloseTradeDialog from "@/components/signals/CloseTradeDialog";
import { RefreshCw, X } from "lucide-react";

const OUTCOME: Record<string, { label: string; cls: string }> = {
  win:       { label: "Win",  cls: "bg-profit/10  text-profit  border-profit/20"              },
  loss:      { label: "Loss", cls: "bg-loss/10    text-loss    border-loss/20"                },
  breakeven: { label: "Even", cls: "bg-secondary  text-muted-foreground border-border"        },
  open:      { label: "Open", cls: "bg-primary/10 text-primary border-primary/20"             },
};

export default function TradesContent() {
  const { trades, loading, reload, totalPnl, openCount, winRate, closedCount } = useTrades();

  const [filter,     setFilter]     = useState<"all" | "open" | "closed">("all");
  const [closeTrade, setCloseTrade] = useState<Trade | null>(null);

  const filtered = trades.filter(t =>
    filter === "all"    ? true :
    filter === "open"   ? t.outcome === "open" :
    t.outcome !== "open"
  );

  const handleOpenClose = (trade: Trade) => {
    setCloseTrade(trade);
  };

  const handleDialogClose = () => {
    setCloseTrade(null);
  };

  const handleDone = () => {
    setCloseTrade(null);
    reload();
  };

  return (
    <div className="space-y-5">

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Trades", value: String(trades.length),                                  pnl: undefined },
          { label: "Open",         value: String(openCount),                                       pnl: undefined },
          { label: "Win Rate",     value: closedCount ? `${winRate}%` : "—",                      pnl: undefined },
          { label: "Total P&L",    value: formatIDR(totalPnl),                                     pnl: totalPnl  },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={cn(
              "text-xl font-bold font-mono",
              s.pnl !== undefined
                ? s.pnl >= 0 ? "text-profit" : "text-loss"
                : "text-foreground"
            )}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter + refresh */}
      <div className="flex items-center gap-2">
        {(["all", "open", "closed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              filter === f
                ? "bg-primary/15 text-primary border-primary/25"
                : "text-muted-foreground border-border hover:text-foreground"
            )}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button onClick={reload}
          className="ml-auto p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_90px_90px_90px_80px_110px] gap-px bg-border text-xs font-medium text-muted-foreground">
          {["Ticker", "Entry", "Exit", "P&L", "R:R", "Status"].map(h => (
            <div key={h} className="bg-card px-3 py-2.5">{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No trades</div>
        ) : (
          filtered.map(t => {
            const oc = OUTCOME[t.outcome] ?? OUTCOME.open;
            const rr = t.pnl_idr != null && t.risk_idr > 0
              ? (t.pnl_idr / t.risk_idr).toFixed(1)
              : "—";

            return (
              <div key={t.id}
                className="grid grid-cols-[1fr_90px_90px_90px_80px_110px] gap-px bg-border hover:bg-border/60 transition-colors">

                {/* Ticker + time */}
                <div className="bg-card px-3 py-3">
                  <p className="text-xs font-semibold text-foreground">{t.ticker}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{timeAgo(t.opened_at)}</p>
                  {t.notes && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate max-w-[140px]" title={t.notes}>
                      📝 {t.notes}
                    </p>
                  )}
                </div>

                {/* Entry */}
                <div className="bg-card px-3 py-3 flex items-center">
                  <span className="text-xs font-mono">{formatPrice(t.entry, t.market)}</span>
                </div>

                {/* Exit */}
                <div className="bg-card px-3 py-3 flex items-center">
                  <span className="text-xs font-mono text-muted-foreground">
                    {t.exit_price != null ? formatPrice(t.exit_price, t.market) : "—"}
                  </span>
                </div>

                {/* P&L */}
                <div className="bg-card px-3 py-3 flex items-center">
                  <span className={cn(
                    "text-xs font-mono font-medium",
                    t.pnl_idr == null ? "text-muted-foreground" :
                    t.pnl_idr >= 0 ? "text-profit" : "text-loss"
                  )}>
                    {t.pnl_idr == null ? "—" : formatIDR(t.pnl_idr)}
                  </span>
                </div>

                {/* R:R */}
                <div className="bg-card px-3 py-3 flex items-center">
                  <span className="text-xs font-mono text-muted-foreground">{rr}</span>
                </div>

                {/* Status + Close button */}
                <div className="bg-card px-3 py-3 flex items-center gap-1.5">
                  <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-medium border", oc.cls)}>
                    {oc.label}
                  </span>
                  {t.outcome === "open" && (
                    <button
                      onClick={() => handleOpenClose(t)}
                      className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      title="Close this trade"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Close Trade Dialog — props di-pass langsung, bukan via spread */}
      <CloseTradeDialog
        trade={closeTrade}
        onClose={handleDialogClose}
        onDone={handleDone}
      />
    </div>
  );
}