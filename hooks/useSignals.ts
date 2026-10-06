import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Signal } from "@/types";

export function useSignals(market?: string, limit = 20) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const fetchSignals = useCallback(
    () =>
      (market ? api.signals.byMarket(market, limit) : api.signals.all(limit))
        .then((data) => {
          setSignals(Array.isArray(data) ? data : []);
          setError(null);
        })
        .catch((e: unknown) => setError(e))
        .finally(() => setLoading(false)),
    [market, limit],
  );

  const reload = useCallback(() => {
    setLoading(true);
    return fetchSignals();
  }, [fetchSignals]);

  useEffect(() => {
    // setState hanya di callback promise — bukan sinkron di badan effect.
    void fetchSignals();
  }, [fetchSignals]);

  return { signals, loading, error, reload };
}
