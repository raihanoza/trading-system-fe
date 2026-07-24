"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, DollarSign, Activity, Target, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { formatIDR } from "@/lib/utils";
import type { Signal, Stats } from "@/types";
import StatCard from "@/components/ui/StatCard";
import SignalCard from "@/components/signals/SignalCard";
import ScanButton from "@/components/ui/ScanButton";
import RecordTradeDialog from "@/components/signals/RecordTradeDialog";

export default function OverviewContent() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeSig, setTradeSig] = useState<Signal | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sig] = await Promise.all([api.stats(), api.signals.all(12)]);
      setStats(s);
      setSignals(sig);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const scanAll = async () => {
    const [s, c, f] = await Promise.allSettled([
      api.scan.stockAll(),
      api.scan.crypto(),
      api.scan.forex(),
    ]);
    const total = [s, c, f]
      .filter((r) => r.status === "fulfilled")
      .reduce(
        (a, r) =>
          a +
          (r as PromiseFulfilledResult<{ signals_found: number }>).value
            .signals_found,
        0,
      );
    await loadData();
    return {
      signals_found: total,
      message: `${total} signal(s) found across all markets`,
    };
  };
  console.log("signals", signals);
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Win Rate"
          value={stats ? `${stats.win_rate_pct}%` : "—"}
          sub={`${stats?.total_trades ?? 0} trades`}
          icon={Target}
          trend={stats && stats.win_rate_pct >= 50 ? "up" : "down"}
          loading={loading}
        />
        <StatCard
          label="Total P&L"
          value={stats ? formatIDR(stats.total_pnl_idr) : "—"}
          sub="All time"
          icon={DollarSign}
          trend={stats && stats.total_pnl_idr >= 0 ? "up" : "down"}
          loading={loading}
        />
        <StatCard
          label="Daily P&L"
          value={stats ? formatIDR(stats.daily_pnl_idr) : "—"}
          sub="Today"
          icon={TrendingUp}
          trend={stats && stats.daily_pnl_idr >= 0 ? "up" : "down"}
          loading={loading}
        />
        <StatCard
          label="Open Positions"
          value={stats ? String(stats.open_positions) : "—"}
          sub="Active"
          icon={Activity}
          loading={loading}
        />
      </div>

      {/* Scan controls */}
      <div className="flex flex-wrap items-center gap-2">
        <ScanButton label="Scan All" onScan={scanAll} variant="primary" />
        <ScanButton
          label="IDX 🇮🇩"
          onScan={async () => {
            const r = await api.scan.stockIdx();
            await loadData();
            return r;
          }}
        />
        <ScanButton
          label="US 🇺🇸"
          onScan={async () => {
            const r = await api.scan.stockUs();
            await loadData();
            return r;
          }}
        />
        <ScanButton
          label="Crypto"
          onScan={async () => {
            const r = await api.scan.crypto();
            await loadData();
            return r;
          }}
        />
        <ScanButton
          label="Forex"
          onScan={async () => {
            const r = await api.scan.forex();
            await loadData();
            return r;
          }}
        />
      </div>

      {/* Recent signals */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">
            Recent Signals
          </h2>
          <span className="text-xs text-muted-foreground">
            {signals.length} signals
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-xl border border-border shimmer"
              />
            ))}
          </div>
        ) : signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-border rounded-xl bg-card/40">
            <Clock className="w-8 h-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No signals yet — run a scan
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {signals.map((s) => (
              <SignalCard key={s.id} signal={s} onTrade={setTradeSig} />
            ))}
          </div>
        )}
      </div>

      {/* Record trade dialog */}
      <RecordTradeDialog
        signal={tradeSig}
        onClose={() => setTradeSig(null)}
        onDone={loadData}
      />
    </div>
  );
}
