"use client";

/**
 * Chart replay — sengaja TERPISAH dari `components/charts/TradingChart.tsx`.
 *
 * TradingChart mengambil datanya sendiri dari `/charts/...`, yaitu **seluruh
 * deret**. Memakainya di sini akan membocorkan masa depan lewat pintu belakang:
 * pemain tinggal menggeser chart ke kanan. Komponen ini tidak pernah mengambil
 * data sendiri — ia hanya menggambar bar yang dioper induknya, dan induknya
 * hanya punya bar sampai kursor.
 */

import { useEffect, useRef, useState } from "react";

export interface Bar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

function toUnixSec(t: string): number {
  const ms = new Date(t).getTime();
  if (!isNaN(ms)) return Math.floor(ms / 1000);
  const clean = t.replace(" ", "T").replace(/\+00:00$/, "Z");
  return Math.floor(new Date(clean).getTime() / 1000);
}

export default function ReplayChart({
  bars,
  levels,
  height = 420,
}: {
  bars: Bar[];
  levels?: { entry?: number; stop_loss?: number; take_profit?: number } | null;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refs = useRef<{ chart: any; candle: any; lines: any[] } | null>(null);
  // Chart dibuat di dalam `import()` yang asinkron, jadi efek penggambar bisa
  // jalan LEBIH DULU daripada chart-nya ada. Tanpa flag ini, `setData` pertama
  // menemukan `refs.current === null` dan diam — chart tetap kosong meski
  // datanya sudah sampai. Persis itu yang terjadi saat halaman ini pertama
  // dijalankan, dan tidak terlihat oleh tsc maupun eslint.
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    import("lightweight-charts").then((lc) => {
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
        rightPriceScale: { borderColor: "#30363d" },
        timeScale: {
          borderColor: "#30363d",
          timeVisible: true,
          secondsVisible: false,
        },
        width: containerRef.current.clientWidth,
        height,
      });
      const candle = chart.addCandlestickSeries({
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
      refs.current = { chart, candle, lines: [] };
      setSiap(true);

      const onResize = () => {
        if (containerRef.current)
          chart.applyOptions({ width: containerRef.current.clientWidth });
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    });

    return () => {
      destroyed = true;
      refs.current?.chart?.remove?.();
      refs.current = null;
      setSiap(false);
    };
  }, [height]);

  useEffect(() => {
    const r = refs.current;
    if (!siap || !r || bars.length === 0) return;
    r.candle.setData(
      bars.map((b) => ({
        time: toUnixSec(b.time),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );
    r.chart.timeScale().fitContent();
  }, [bars, siap]);

  useEffect(() => {
    const r = refs.current;
    if (!siap || !r) return;
    r.lines.forEach((l) => r.candle.removePriceLine(l));
    r.lines = [];
    if (!levels) return;
    const spec: [number | undefined, string, string][] = [
      [levels.entry, "#3b82f6", "entry"],
      [levels.stop_loss, "#ef4444", "SL"],
      [levels.take_profit, "#22c55e", "TP"],
    ];
    spec.forEach(([price, color, title]) => {
      if (price == null || !isFinite(price)) return;
      r.lines.push(
        r.candle.createPriceLine({
          price,
          color,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title,
        }),
      );
    });
  }, [levels, siap]);

  return <div ref={containerRef} style={{ height }} className="w-full" />;
}
