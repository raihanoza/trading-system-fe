"use client";

import { useState, useEffect } from "react";
import { Activity, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Heartbeat } from "@/types";

/**
 * Chip "scan terakhir: N jam lalu" (Fase A, 4.1).
 *
 * Sistem ini diam dari 24 Mei sampai 27 Juli 2026 tanpa ada yang tahu, karena
 * layar kosong terbaca sebagai "tidak ada setup bagus" — padahal scanner-nya
 * memang tidak jalan. Chip ini membuat perbedaan itu tidak bisa disalahpahami:
 * scan sukses dengan NOL sinyal tetap tampil hijau.
 */
function formatAge(hours: number | null): string {
  if (hours == null) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m lalu`;
  if (hours < 48) return `${Math.round(hours)} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}

export default function HeartbeatChip() {
  const [hb, setHb] = useState<Heartbeat | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // setState hanya di dalam callback promise — bukan sinkron di badan effect.
    const tick = () =>
      api
        .heartbeat()
        .then((d) => {
          if (cancelled) return;
          setHb(d);
          setFailed(false);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });

    tick();
    const id = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (failed || !hb) return null;

  // Mesin paling segar mewakili chip; detail per market ada di tooltip.
  const freshest = hb.markets
    .filter((m) => m.hours_ago != null)
    .sort((a, b) => (a.hours_ago ?? 0) - (b.hours_ago ?? 0))[0];

  const tooltip = [
    hb.message,
    "",
    ...hb.markets.map((m) => {
      const age = m.status === "never" ? "belum pernah" : formatAge(m.hours_ago);
      const detail =
        m.status === "never" ? "" : ` · ${m.signals} sinyal / ${m.tickers} ticker`;
      const err = m.last_error ? `\n   ↳ ${m.last_error.message}` : "";
      return `${m.market}: ${age}${detail}${err}`;
    }),
  ].join("\n");

  return (
    <span
      title={tooltip}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border",
        hb.stale
          ? "bg-destructive/10 text-destructive border-destructive/20"
          : "bg-secondary/50 text-muted-foreground border-border",
      )}
    >
      {hb.stale ? (
        <AlertTriangle className="w-3 h-3" />
      ) : (
        <Activity className="w-3 h-3" />
      )}
      <span className="hidden sm:inline">Scan</span>
      <span className="tabular-nums">
        {hb.stale && !freshest ? "belum pernah" : formatAge(freshest?.hours_ago ?? null)}
      </span>
    </span>
  );
}
