import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Trade } from "@/types";

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrades(await api.trades.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trades");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalPnl = trades
    .filter((t) => t.pnl_idr !== null)
    .reduce((a, b) => a + (b.pnl_idr || 0), 0);
  const openCount = trades.filter((t) => t.outcome === "open").length;
  const winCount = trades.filter((t) => t.outcome === "win").length;
  const closedCount = trades.filter((t) => t.outcome !== "open").length;
  const winRate =
    closedCount > 0 ? Math.round((winCount / closedCount) * 100) : 0;

  return {
    trades,
    loading,
    error,
    reload: load,
    totalPnl,
    openCount,
    winRate,
    closedCount,
  };
}
