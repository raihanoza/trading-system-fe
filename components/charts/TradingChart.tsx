"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { describeApiError } from "@/lib/api-error";
import type { ChartData, Evidence, Freshness } from "@/types";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw } from "lucide-react";

interface Props {
  market: string;
  ticker: string;
  interval?: string;
  height?: number;
  /** Kalau diisi, respons menyertakan overlay entry/SL/TP + freshness sinyal itu. */
  signalId?: number;
}

const INTERVALS = [
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
];

// Freshness chip — warna per verdict.
const VERDICT_STYLE: Record<string, string> = {
  actionable: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  chasing: "text-amber-400 bg-amber-500/10 border-amber-500/25",
  invalidated: "text-red-400 bg-red-500/10 border-red-500/25",
  resolved: "text-muted-foreground bg-secondary border-border",
};

function toUnixSec(t: string): number {
  const ms = new Date(t).getTime();
  if (isNaN(ms)) {
    // Fallback: parse "2025-07-04 00:00:00+00:00" manually
    const clean = t.replace(" ", "T").replace(/\+00:00$/, "Z");
    return Math.floor(new Date(clean).getTime() / 1000);
  }
  return Math.floor(ms / 1000);
}

export default function TradingChart({
  market,
  ticker,
  interval: defaultInterval = "1d",
  height = 400,
  signalId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<{ candle: any; volume: any; chart: any } | null>(
    null,
  );
  // Handle price line yang digambar — dilacak supaya bisa dihapus sebelum redraw
  // (kalau tidak, ganti interval/retry menumpuk garis ganda).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceLinesRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState(defaultInterval);
  const [retryKey, setRetryKey] = useState(0);
  const [freshness, setFreshness] = useState<Freshness | null>(null);

  // ── Init chart ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    import("lightweight-charts")
      .then((lc) => {
        if (destroyed || !containerRef.current) return;

        const chart = lc.createChart(containerRef.current, {
          layout: {
            background: { type: lc.ColorType.Solid, color: "#0d1117" },
            textColor: "#8b949e",
          },
          grid: {
            vertLines: { color: "#1c2128" },
            horzLines: { color: "#1c2128" },
          },
          crosshair: {
            mode: 1,
            vertLine: {
              color: "#8b949e66",
              width: 1,
              style: 2,
              labelBackgroundColor: "#21262d",
            },
            horzLine: {
              color: "#8b949e66",
              width: 1,
              style: 2,
              labelBackgroundColor: "#21262d",
            },
          },
          rightPriceScale: {
            borderColor: "#30363d",
            scaleMargins: { top: 0.08, bottom: 0.22 },
          },
          timeScale: {
            borderColor: "#30363d",
            timeVisible: true,
            secondsVisible: false,
          },
          width: containerRef.current.clientWidth,
          height: height,
        });

        const candle = chart.addCandlestickSeries({
          upColor: "#22c55e",
          downColor: "#ef4444",
          borderUpColor: "#22c55e",
          borderDownColor: "#ef4444",
          wickUpColor: "#22c55e",
          wickDownColor: "#ef4444",
        });

        const volume = chart.addHistogramSeries({
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
        });
        chart.priceScale("volume").applyOptions({
          scaleMargins: { top: 0.82, bottom: 0 },
        });

        seriesRef.current = { candle, volume, chart };

        // Signal that chart is ready
        setReady(true);

        // Resize observer
        const ro = new ResizeObserver(() => {
          if (!destroyed && containerRef.current) {
            chart.applyOptions({ width: containerRef.current.clientWidth });
          }
        });
        ro.observe(containerRef.current);

        return () => {
          destroyed = true;
          ro.disconnect();
          chart.remove();
          seriesRef.current = null;
          priceLinesRef.current = [];
          setReady(false);
        };
      })
      .catch(() => {
        setError(
          "Chart library failed to load. Run: npm install lightweight-charts@4.2.0",
        );
        setLoading(false);
      });

    return () => {
      destroyed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // Hapus semua price line yang dilacak (dipanggil di awal tiap redraw).
  const clearPriceLines = useCallback(() => {
    const candle = seriesRef.current?.candle;
    if (candle) {
      priceLinesRef.current.forEach((pl) => {
        try {
          candle.removePriceLine(pl);
        } catch {
          /* ignore */
        }
      });
    }
    priceLinesRef.current = [];
  }, []);

  // ── Load data — only runs AFTER chart is ready ───────────────────────────
  const loadData = useCallback(async () => {
    if (!seriesRef.current) return;
    setLoading(true);
    setError(null);

    try {
      const data: ChartData = await api.chart(
        market,
        ticker,
        interval,
        signalId,
      );

      if (!seriesRef.current) return; // chart was destroyed while fetching

      if (!data.candles || data.candles.length === 0) {
        setError("No candle data from API");
        return;
      }

      // Build + sort + deduplicate candles
      const seen = new Set<number>();
      const candleData: {
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
      }[] = [];
      const volumeData: { time: number; value: number; color: string }[] = [];

      data.candles
        .map((c) => ({ unix: toUnixSec(c.t), c }))
        .sort((a, b) => a.unix - b.unix)
        .forEach(({ unix, c }) => {
          if (seen.has(unix)) return;
          seen.add(unix);
          candleData.push({
            time: unix,
            open: c.o,
            high: c.h,
            low: c.l,
            close: c.c,
          });
          volumeData.push({
            time: unix,
            value: c.v,
            color: c.c >= c.o ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)",
          });
        });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seriesRef.current.candle.setData(candleData as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seriesRef.current.volume.setData(volumeData as any);

      // Bersihkan overlay lama sebelum menggambar ulang (fix bug penumpukan).
      clearPriceLines();

      const candle = seriesRef.current.candle;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const addLine = (opts: any) => {
        try {
          priceLinesRef.current.push(candle.createPriceLine(opts));
        } catch {
          /* ignore */
        }
      };

      // ── S/R lines ─────────────────────────────────────────────────────
      if (Array.isArray(data.sr_levels)) {
        data.sr_levels.forEach((level) => {
          addLine({
            price: level.price,
            color:
              level.type === "support"
                ? "rgba(34,197,94,0.55)"
                : level.type === "resistance"
                  ? "rgba(239,68,68,0.55)"
                  : "rgba(96,165,250,0.55)",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `${level.strength?.[0]?.toUpperCase() ?? "S"} (${level.touches})`,
          });
        });
      }

      // ── Evidence overlay (Fase 2) ─────────────────────────────────────
      const evidence: Evidence | undefined = data.evidence;
      setFreshness(evidence?.freshness ?? null);

      if (evidence) {
        const firstT = candleData[0]?.time ?? -Infinity;
        const lastT = candleData[candleData.length - 1]?.time ?? Infinity;
        const inRange = (u: number) => u >= firstT && u <= lastT;

        // Entry / SL / TP dari freshness (backend echo dari baris sinyal DB).
        const fr = evidence.freshness;
        if (fr) {
          addLine({
            price: fr.entry,
            color: "#60a5fa",
            lineWidth: 2,
            lineStyle: 0,
            axisLabelVisible: true,
            title: "Entry",
          });
          addLine({
            price: fr.stop_loss,
            color: "#ef4444",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: "SL",
          });
          addLine({
            price: fr.take_profit,
            color: "#22c55e",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: "TP",
          });
        }

        // FVG band — hanya yang unfilled, maks 3 terdekat ke harga (kurangi noise).
        const price =
          fr?.current_price ?? candleData[candleData.length - 1]?.close ?? 0;
        const mid = (f: { top: number; bottom: number }) =>
          (f.top + f.bottom) / 2;
        [...(evidence.fvgs ?? [])]
          .filter((f) => !f.filled)
          .sort((a, b) => Math.abs(mid(a) - price) - Math.abs(mid(b) - price))
          .slice(0, 3)
          .forEach((f) => {
            const col =
              f.direction === "bullish"
                ? "rgba(34,197,94,0.45)"
                : "rgba(239,68,68,0.45)";
            addLine({
              price: f.top,
              color: col,
              lineWidth: 1,
              lineStyle: 1,
              axisLabelVisible: false,
              title: "FVG",
            });
            addLine({
              price: f.bottom,
              color: col,
              lineWidth: 1,
              lineStyle: 1,
              axisLabelVisible: false,
              title: "",
            });
          });

        // Markers — sweep (panah) + BOS/CHoCH (bulatan). Difilter ke rentang candle.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const markers: any[] = [];
        (evidence.sweeps ?? []).forEach((s) => {
          const u = toUnixSec(s.time);
          if (!inRange(u)) return;
          const bull = s.direction === "bullish_sweep";
          markers.push({
            time: u,
            position: bull ? "belowBar" : "aboveBar",
            color: "#f59e0b",
            shape: bull ? "arrowUp" : "arrowDown",
            text: "SWEEP",
          });
        });
        (evidence.structure ?? []).forEach((p) => {
          const u = toUnixSec(p.time);
          if (!inRange(u)) return;
          const bull = p.direction === "bullish";
          markers.push({
            time: u,
            position: bull ? "belowBar" : "aboveBar",
            color: bull ? "#22c55e" : "#ef4444",
            shape: "circle",
            text: p.event,
          });
        });
        markers.sort((a, b) => a.time - b.time);
        candle.setMarkers(markers);
      } else {
        seriesRef.current.candle.setMarkers([]);
      }

      seriesRef.current.chart.timeScale().fitContent();
    } catch (err) {
      console.error("Chart load error:", err);
      const d = describeApiError(err, "memuat chart");
      setError(`${d.title}. ${d.description}`);
    } finally {
      setLoading(false);
    }
  }, [market, ticker, interval, signalId, retryKey, clearPriceLines]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger data load when chart is ready OR interval/ticker changes
  useEffect(() => {
    if (!ready) return;
    // Dijadwalkan, bukan dipanggil sinkron: loadData langsung setState
    // (react-hooks/set-state-in-effect).
    const t = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(t);
  }, [ready, loadData]);

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-[#0d1117]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold font-mono text-foreground">
            {ticker}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary border border-border">
            {market.replace(/_/g, " ")}
          </span>
          {freshness && (
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border truncate",
                VERDICT_STYLE[freshness.verdict] ?? VERDICT_STYLE.resolved,
              )}
              title={`zone: ${freshness.zone} · outcome: ${freshness.outcome}`}
            >
              {freshness.verdict} · {freshness.zone.replace(/_/g, " ")} ·{" "}
              {freshness.dist_to_entry_pct > 0 ? "+" : ""}
              {freshness.dist_to_entry_pct}%
              {freshness.outcome !== "pending" ? ` · ${freshness.outcome}` : ""}
            </span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              onClick={() => setInterval(iv.value)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                interval === iv.value
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary",
              )}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <div className="relative" style={{ height }}>
        <div ref={containerRef} className="w-full h-full" />

        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117]/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              <span className="text-xs text-muted-foreground font-mono">
                {ticker}
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0d1117]">
            <p className="text-xs text-muted-foreground text-center max-w-xs px-4">
              {error}
            </p>
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap px-4 py-2 border-t border-border bg-card text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t-2 border-[#60a5fa]" />
          Entry
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t border-dashed border-[#ef4444]" />
          SL
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t border-dashed border-[#22c55e]" />
          TP
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t border-dotted border-[rgba(34,197,94,0.6)]" />
          FVG
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[#f59e0b]">↑</span>
          Sweep
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[#22c55e]">●</span>
          BOS/CHoCH
        </span>
        <span className="ml-auto">Drag to pan · Scroll to zoom</span>
      </div>
    </div>
  );
}
