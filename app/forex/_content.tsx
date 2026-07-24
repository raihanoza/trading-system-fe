"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Signal } from "@/types";
import SignalCard from "@/components/signals/SignalCard";
import ScanButton from "@/components/ui/ScanButton";
import TradingChart from "@/components/charts/TradingChart";
import { Clock, DollarSign } from "lucide-react";

const KILL_ZONES = [
  {
    name: "London",
    time: "14:00 – 17:00 WIB",
    active: () => {
      const h = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Jakarta",
        hour: "numeric",
        hour12: false,
      });
      const hr = parseInt(h);
      return hr >= 14 && hr < 17;
    },
  },
  {
    name: "New York",
    time: "20:30 – 23:00 WIB",
    active: () => {
      const now = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Jakarta",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
      const [h, m] = now.split(":").map(Number);
      const mins = h * 60 + (m || 0);
      return mins >= 1230 && mins < 1380;
    },
  },
];

export default function ForexContent() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [chart, setChart] = useState<string | null>(null);
  const [scanInfo, setScanInfo] = useState<{
    session?: string;
    wib_time?: string;
    message?: string;
  } | null>(null);

  const scan = useCallback(async () => {
    const r = await api.scan.forex();
    setSignals(r.signals as Signal[]);
    setScanInfo({
      session: r.session,
      wib_time: r.wib_time,
      message: r.message,
    });
    return r;
  }, []);

  return (
    <div className="space-y-6">
      {/* Kill zone status */}
      <div className="grid grid-cols-2 gap-3">
        {KILL_ZONES.map((kz) => {
          const active = kz.active();
          return (
            <div
              key={kz.name}
              className={`rounded-xl border p-3 ${active ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${active ? "bg-primary animate-pulse-dot" : "bg-muted-foreground/30"}`}
                />
                <span
                  className={`text-xs font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
                >
                  {kz.name} Kill Zone
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {kz.time}
              </p>
              {active && (
                <p className="text-xs text-primary mt-1 font-medium">
                  Active now
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <ScanButton label="Scan Forex" onScan={scan} variant="primary" />
        {scanInfo?.wib_time && (
          <span className="text-xs text-muted-foreground font-mono">
            {scanInfo.wib_time}
          </span>
        )}
      </div>

      {scanInfo?.message && (
        <div className="px-4 py-3 rounded-lg bg-secondary/50 border border-border text-xs text-muted-foreground">
          {scanInfo.message}
        </div>
      )}

      {chart && (
        <TradingChart
          market="forex"
          ticker={chart}
          interval="1h"
          height={380}
        />
      )}

      {signals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-border rounded-xl bg-card/40">
          <DollarSign className="w-8 h-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No forex signals</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Signals only appear during kill zones
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
