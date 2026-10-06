"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";
import type { DailyReportCard } from "@/types";
import { ApiErrorNotice } from "@/components/system/StateNotice";

/**
 * Kartu harian — teks yang SAMA PERSIS dengan yang dikirim ke WhatsApp 07:00.
 *
 * Sampai 2 September 2026 laporan ini hanya bisa dilihat dengan menunggu job
 * harian menembak. Isinya tidak pernah butuh scheduler; yang mengikat cuma
 * tempat kodenya tinggal (metode privat `TradingScheduler`). Sekarang
 * `core/report_card.py` melayani tiga pintu — WhatsApp, `GET /report-card`,
 * dan `python -m core.report_card` — dari satu fungsi.
 *
 * Teksnya ditampilkan APA ADANYA, termasuk markup WhatsApp (`*tebal*`,
 * `_miring_`). Itu keputusan, bukan kemalasan: begitu halaman ini mengurai
 * lalu merangkai ulang isinya, ia berhenti jadi laporan yang sama dan mulai
 * jadi laporan kedua yang bisa bergeser diam-diam dari pesan yang benar-benar
 * Anda terima. Dengan bentuk mentah, keduanya bisa dibandingkan baris demi
 * baris.
 */
export default function DailyReportCard() {
  const [data, setData] = useState<DailyReportCard | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  // `setLoading(true)` TIDAK dipanggil di sini: effect yang setState sinkron
  // memicu cascading render (react-hooks/set-state-in-effect). `loading`
  // dimulai true dan hanya dimatikan di `.finally`; tombol muat-ulang yang
  // menyalakannya lagi, dan itu event handler — bukan badan effect.
  const muat = useCallback(() => {
    api
      .dailyReportCard()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Kartu harian</h2>
          <p className="text-xs text-muted-foreground">
            Teks yang sama persis dengan pesan WhatsApp pukul 07:00 — tidak
            perlu menunggu jamnya.
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            muat();
          }}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={loading ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"} />
          Muat ulang
        </button>
      </header>

      <div className="p-4">
        {error != null && (
          <ApiErrorNotice error={error} action="memuat kartu harian" />
        )}

        {!error && !data && loading && (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        )}

        {data && (
          <>
            {/* `whitespace-pre-wrap` menjaga baris & spasi persis seperti yang
                dikirim. Monospace supaya kolom angka tetap sejajar. */}
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
              {data.text}
            </pre>
            <p className="mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground">
              Jendela {data.days} hari · dihitung{" "}
              {new Date(data.generated_at).toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
