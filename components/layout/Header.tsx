"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { getWIBTime } from "@/lib/utils";
import HeartbeatChip from "./HeartbeatChip";
import RuntimeStatusChip from "@/components/system/RuntimeStatusChip";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Overview",
  "/stock": "Stock",
  "/crypto": "Crypto",
  "/forex": "Forex",
  "/trades": "Trades",
  "/stats": "Analytics",
  "/report-card": "Report Card",
  "/log": "Log Pencatatan",
  "/belajar": "Belajar",
  "/journal": "Trading Journal",
  "/market": "Market Overview",
  "/sentiment": "Sentiment Analysis",
  "/ml": "ML (eksperimental)",
  "/backtest": "Backtesting Engine",
  "/settings": "Sistem & Runtime",
};

function getTitle(pathname: string): string {
  return ROUTE_TITLES[pathname] ?? ROUTE_TITLES["/"];
}

export default function Header() {
  const pathname = usePathname();
  const title = getTitle(pathname);
  const [time, setTime] = useState("");

  useEffect(() => {
    // setState hanya di callback timer — bukan sinkron di badan effect.
    const tick = () => setTime(getWIBTime());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>

      <div className="flex items-center gap-3">
        {/* WIB Clock */}
        <span className="hidden sm:block font-mono text-xs text-muted-foreground tabular-nums">
          {time}
        </span>

        {/* Watchdog — "API terhubung" hanya berarti server hidup, bukan scanner. */}
        <HeartbeatChip />

        {/* Koneksi API (dari server frontend), mode PAPER/LIVE, build FE */}
        <RuntimeStatusChip />
      </div>
    </header>
  );
}
