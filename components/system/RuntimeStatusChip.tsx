"use client";

import Link from "next/link";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useRuntime } from "@/lib/runtime";
import { cn } from "@/lib/utils";
import { backendStatusLabel } from "./RuntimeIdentityPanel";

/**
 * Chip header: status koneksi API, mode PAPER/LIVE, dan build frontend.
 *
 * Dulu tombol "Connected" hanya berarti `/health` menjawab langsung dari
 * browser. Sekarang statusnya diperiksa dari server frontend lewat jalur yang
 * sama dengan proxy, dan mode eksekusi ikut tampil supaya "paper" tidak
 * pernah perlu ditebak.
 */
export default function RuntimeStatusChip() {
  const { report, error, loading } = useRuntime();
  const status = backendStatusLabel(report);
  const mode = report?.backend.runtime?.mode ?? null;
  const build = report?.frontend.build_id;
  const stale = report?.frontend.source_matches_build === false;

  const connected = report?.backend.status === "ok" || report?.backend.status === "legacy";
  const label = error
    ? "UI server tak terjangkau"
    : !report
      ? "Memeriksa…"
      : connected
        ? "API terhubung"
        : "API terputus";

  const title = [
    `Koneksi API: ${error ? "server frontend tidak menjawab" : status.label}`,
    report?.backend.error ? `  ↳ ${report.backend.error}` : null,
    `Mode: ${mode ? mode.toUpperCase() : "tidak diketahui"}`,
    `Build FE: ${build ?? "?"}${stale ? " (sumber di disk sudah berbeda)" : ""}`,
    report?.backend.contract
      ? `Kontrak: ${report.backend.contract.policy ?? "?"} · ${report.backend.contract.spec_hash}`
      : null,
    "Klik untuk detail di halaman Sistem.",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Link
      href="/settings"
      title={title}
      data-testid="runtime-chip"
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all",
        error || (report && !connected)
          ? "bg-destructive/10 text-destructive border-destructive/20"
          : report
            ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15"
            : "border-border text-muted-foreground bg-secondary/50",
      )}
    >
      {loading && !report ? (
        <RefreshCw className="w-3 h-3 animate-spin" />
      ) : connected && !error ? (
        <Wifi className="w-3 h-3" />
      ) : (
        <WifiOff className="w-3 h-3" />
      )}
      <span>{label}</span>
      {mode && (
        <span
          className={cn(
            "rounded px-1 py-px text-[10px] font-semibold tracking-wide border",
            mode === "paper"
              ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
              : "border-destructive/40 bg-destructive/15 text-destructive",
          )}
        >
          {mode.toUpperCase()}
        </span>
      )}
      {build && (
        <span
          className={cn(
            "hidden md:inline font-mono text-[10px]",
            stale ? "text-amber-400" : "text-muted-foreground",
          )}
        >
          {build}
        </span>
      )}
    </Link>
  );
}
