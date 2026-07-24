"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Signal } from "@/types";
import SignalCard from "@/components/signals/SignalCard";
import ScanButton from "@/components/ui/ScanButton";
import TradingChart from "@/components/charts/TradingChart";
import { Zap } from "lucide-react";

export default function CryptoContent() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [chart, setChart] = useState<string | null>(null);

  const scan = useCallback(async () => {
    const r = await api.scan.crypto();
    setSignals(r.signals as Signal[]);
    return r;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ScanButton label="Scan Crypto" onScan={scan} variant="primary" />
        <span className="text-xs text-muted-foreground">
          Scans every 4 hours automatically
        </span>
      </div>

      {chart && (
        <TradingChart
          market="crypto"
          ticker={chart}
          interval="4h"
          height={380}
        />
      )}

      {signals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-border rounded-xl bg-card/40">
          <Zap className="w-8 h-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No crypto signals</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Run a scan to find setups
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {signals.map((s) => (
            <div
              key={s.id}
              onClick={() => setChart(s.ticker)}
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
