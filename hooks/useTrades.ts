import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Trade } from "@/types";

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  // Galat dipertahankan sebagai objek (ApiError) supaya layar bisa
  // membedakan "backend mati" dari "belum ada trade".
  const [error, setError] = useState<unknown>(null);

  const fetchTrades = useCallback(
    () =>
      api.trades
        .list()
        .then((rows) => {
          setTrades(Array.isArray(rows) ? rows : []);
          setError(null);
        })
        .catch((e: unknown) => setError(e))
        .finally(() => setLoading(false)),
    [],
  );

  const reload = useCallback(() => {
    setLoading(true);
    return fetchTrades();
  }, [fetchTrades]);

  useEffect(() => {
    // setState hanya di callback promise — bukan sinkron di badan effect.
    void fetchTrades();
  }, [fetchTrades]);

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
    reload,
    totalPnl,
    openCount,
    winRate,
    closedCount,
  };
}
