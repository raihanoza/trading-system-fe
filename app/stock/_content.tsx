"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Signal } from "@/types";
import SignalCard from "@/components/signals/SignalCard";
import ScanButton from "@/components/ui/ScanButton";
import TradingChart from "@/components/charts/TradingChart";
import { Search } from "lucide-react";

export default function StockContent() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [activeTab, setActiveTab] = useState<"idx" | "us">("idx");
  const [search, setSearch] = useState("");
  const [chartTicker, setChartTicker] = useState<{
    ticker: string;
    market: string;
  } | null>(null);

  const scanIDX = useCallback(async () => {
    const r = await api.scan.stockIdx();
    setSignals(r.signals as Signal[]);
    setActiveTab("idx");
    return r;
  }, []);

  const scanUS = useCallback(async () => {
    const r = await api.scan.stockUs();
    setSignals(r.signals as Signal[]);
    setActiveTab("us");
    return r;
  }, []);

  const filtered = signals.filter(
    (s) =>
      s.submarket.toLowerCase() === activeTab &&
      (search === "" || s.ticker.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <ScanButton
          label="Scan IDX 🇮🇩"
          onScan={scanIDX}
          variant={activeTab === "idx" ? "primary" : "secondary"}
        />
        <ScanButton
          label="Scan US 🇺🇸"
          onScan={scanUS}
          variant={activeTab === "us" ? "primary" : "secondary"}
        />

        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticker..."
            className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 w-44"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["idx", "us"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab
                ? "bg-primary/15 text-primary border border-primary/25"
                : "text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            {tab === "idx" ? "🇮🇩 IDX" : "🇺🇸 US"} (
            {signals.filter((s) => s.submarket.toLowerCase() === tab).length})
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartTicker && (
        <TradingChart
          market={chartTicker.market}
          ticker={chartTicker.ticker}
          interval="1d"
          height={380}
        />
      )}

      {/* Signals grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-border rounded-xl bg-card/40">
          <p className="text-sm text-muted-foreground">
            No {activeTab.toUpperCase()} signals
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Run a scan to find setups
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              onClick={() =>
                setChartTicker({ ticker: s.ticker, market: s.market })
              }
              className="cursor-pointer"
            >
              <SignalCard signal={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
