"use client";

import { RefreshCw } from "lucide-react";
import { useRuntime } from "@/lib/runtime";
import RuntimeIdentityPanel from "@/components/system/RuntimeIdentityPanel";
import MetricGlossary from "@/components/system/MetricGlossary";
import { ApiErrorNotice } from "@/components/system/StateNotice";
import { cn } from "@/lib/utils";

/**
 * Halaman Sistem: identitas build/runtime yang bisa diperiksa + arti angka.
 * Sumbernya `GET /api/runtime` (server frontend) yang ikut memeriksa backend
 * `GET /system/runtime`. Endpoint yang sama bisa dibuka langsung untuk
 * verifikasi tanpa UI.
 */
export default function SystemContent() {
  const { report, error, loading, refresh } = useRuntime();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Endpoint diagnostik: <code className="font-mono">/api/runtime</code> (frontend) dan{" "}
          <code className="font-mono">/system/runtime</code> (backend).
          {report && ` Diperiksa ${new Date(report.checked_at).toLocaleTimeString("id-ID")}.`}
        </p>
        <button
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} /> Periksa ulang
        </button>
      </div>

      {error && <ApiErrorNotice error={error} action="memeriksa runtime" onRetry={() => void refresh()} />}
      {!report && !error && <p className="text-sm text-muted-foreground">Memeriksa…</p>}
      {report && <RuntimeIdentityPanel report={report} />}

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Cara membaca angka di aplikasi ini</h2>
        <p className="mt-1 mb-3 text-xs text-muted-foreground">
          Penjelasan mengikuti kontrak dan konfigurasi yang dilaporkan backend saat ini.
        </p>
        <MetricGlossary
          runtime={report?.backend.runtime ?? null}
          contract={report?.backend.contract ?? null}
        />
      </section>
    </div>
  );
}
