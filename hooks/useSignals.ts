import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Signal } from "@/types";

export function useSignals(market?: string, limit = 20) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = market
        ? await api.signals.byMarket(market, limit)
        : await api.signals.all(limit);
      setSignals(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load signals");
    } finally {
      setLoading(false);
    }
  }, [market, limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { signals, loading, error, reload: load };
}
