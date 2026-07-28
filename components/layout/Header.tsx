"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import { getWIBTime, cn } from "@/lib/utils";
import HeartbeatChip from "./HeartbeatChip";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Overview",
  "/stock": "Stock",
  "/crypto": "Crypto",
  "/forex": "Forex",
  "/trades": "Trades",
  "/stats": "Analytics",
  "/report-card": "Report Card",
  "/journal": "Trading Journal",
  "/market": "Market Overview",
  "/sentiment": "Sentiment Analysis",
  "/ml": "ML Signal Optimizer",
  "/backtest": "Backtesting Engine",
  "/settings": "Settings",
};

function getTitle(pathname: string): string {
  return ROUTE_TITLES[pathname] ?? ROUTE_TITLES["/"];
}

export default function Header() {
  const pathname = usePathname();
  const title = getTitle(pathname);

  const [connected, setConnected] = useState<boolean | null>(null);
  const [time, setTime] = useState("");
  const [checking, setChecking] = useState(false);

  const checkHealth = async () => {
    setChecking(true);
    try {
      await api.health();
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const healthInterval = setInterval(checkHealth, 30_000);
    const timeInterval = setInterval(() => setTime(getWIBTime()), 1_000);
    setTime(getWIBTime());
    return () => {
      clearInterval(healthInterval);
      clearInterval(timeInterval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>

      <div className="flex items-center gap-3">
        {/* WIB Clock */}
        <span className="hidden sm:block font-mono text-xs text-muted-foreground tabular-nums">
          {time}
        </span>

        {/* Watchdog — API "Connected" hanya berarti server hidup, bukan scanner. */}
        <HeartbeatChip />

        {/* API Status */}
        <button
          onClick={checkHealth}
          title="Click to check API connection"
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all",
            connected === null
              ? "border-border text-muted-foreground bg-secondary/50"
              : connected
                ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15"
                : "bg-destructive/10 text-destructive border-destructive/20",
          )}
        >
          {checking ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : connected ? (
            <Wifi className="w-3 h-3" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          <span>
            {checking
              ? "Checking"
              : connected === null
                ? "—"
                : connected
                  ? "Connected"
                  : "Offline"}
          </span>
        </button>
      </div>
    </header>
  );
}
