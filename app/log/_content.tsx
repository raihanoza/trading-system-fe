"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCw,
  Snowflake,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SignalLogKelas, SignalLogResponse, SignalLogRow } from "@/types";

const MARKETS = ["", "crypto", "forex", "stock", "stock_idx", "stock_us"];

/**
 * Tiga kelas baris, tiga arti yang berbeda total — dan dua di antaranya
 * sama-sama `action='SKIP'` di DB. Kalau warnanya sama, "ditolak aturan
 * mekanis" (setup nyata, level nyata) terbaca sama dengan "gugur di tangga
 * tier", dan pembacanya menyimpulkan hal yang salah tentang kenapa sinyal
 * tidak terbit.
 */
const KELAS_STYLE: Record<SignalLogKelas, string> = {
  terbit: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  shadow: "bg-secondary text-muted-foreground border-border",
  diagnostik: "bg-violet-400/10 text-violet-400 border-violet-400/20",
};

const OUTCOME_STYLE: Record<string, string> = {
  win: "text-emerald-400",
  loss: "text-destructive",
  expired: "text-yellow-400",
};

function waktu(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

/** Nilai kosong dicetak sebagai "—", BUKAN 0 — keduanya keadaan berbeda. */
function nilai(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "ya" : "tidak";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function Field({ k, v }: { k: string; v: unknown }) {
  const kosong = v === null || v === undefined || v === "";
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="text-[11px] text-muted-foreground shrink-0">{k}</span>
      <span
        className={cn(
          "text-xs tabular-nums truncate",
          kosong ? "text-muted-foreground/50" : "text-foreground",
        )}
      >
        {nilai(v)}
      </span>
    </div>
  );
}

function Trail({ row }: { row: SignalLogRow }) {
  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      {row.trail.map((t, i) => (
        <div
          key={i}
          className={cn(
            "rounded-md border p-3",
            t.menunggu
              ? "border-dashed border-border bg-secondary/30"
              : "border-border bg-secondary/50",
          )}
        >
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-xs font-semibold capitalize">{t.tahap}</span>
            <span className="text-[11px] text-muted-foreground">
              {waktu(t.waktu)}
            </span>
            {t.menunggu && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-border text-muted-foreground">
                <Clock className="w-3 h-3" /> belum terjadi
              </span>
            )}
            {t.beku && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-yellow-400/20 bg-yellow-400/10 text-yellow-400">
                <Snowflake className="w-3 h-3" /> beku
              </span>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground mb-2 font-mono">
            {t.penulis}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
            {Object.entries(t.dicatat).map(([k, v]) => (
              <Field key={k} k={k} v={v} />
            ))}
          </div>

          {t.penggaris && (
            <div className="mt-2 pt-2 border-t border-border/60">
              <p className="text-[11px] text-muted-foreground mb-1">
                Penggaris — menentukan apakah baris ini sebanding dengan baris
                lain
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                {Object.entries(t.penggaris).map(([k, v]) => (
                  <Field key={k} k={k} v={v} />
                ))}
              </div>
            </div>
          )}

          {t.gates?.vektor && (
            <div className="mt-2 pt-2 border-t border-border/60">
              <p className="text-[11px] text-muted-foreground mb-1">
                Vektor gate saat terbit
              </p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(t.gates.vektor).map(([g, ok]) => (
                  <span
                    key={g}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] border",
                      ok
                        ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                        : "bg-secondary text-muted-foreground border-border",
                    )}
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {t.catatan && (
            <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
              {t.catatan}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function SignalLogContent() {
  const [data, setData] = useState<SignalLogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [market, setMarket] = useState("");
  const [shadow, setShadow] = useState(true);
  const [buka, setBuka] = useState<number | null>(null);

  // `setLoading(true)` TIDAK dipanggil di sini: effect yang setState sinkron
  // memicu cascading render (react-hooks/set-state-in-effect). `loading`
  // dimulai true dan hanya dimatikan di `.finally`; tombol muat-ulang yang
  // menyalakannya lagi, dan itu event handler — bukan badan effect.
  const muat = useCallback(() => {
    api.signals
      .log(50, market || undefined, shadow)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Gagal memuat log"),
      )
      .finally(() => setLoading(false));
  }, [market, shadow]);

  useEffect(() => {
    muat();
  }, [muat]);

  return (
    <div className="flex flex-col gap-4">
      {/* Kontrol */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={market}
          onChange={(e) => setMarket(e.target.value)}
          className="px-2.5 py-1.5 rounded-md border border-border bg-card text-xs"
        >
          {MARKETS.map((m) => (
            <option key={m} value={m}>
              {m || "semua pasar"}
            </option>
          ))}
        </select>

        <label className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border cursor-pointer">
          <input
            type="checkbox"
            checked={shadow}
            onChange={(e) => setShadow(e.target.checked)}
          />
          ikutkan baris yang tak pernah dikirim
        </label>

        <button
          onClick={() => {
            setLoading(true);
            muat();
          }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={loading ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"} />
          Muat ulang
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <>
          {/* Porsi per kelas ikut dicetak: daftar yang mencampur baris terbit
              dan shadow tanpa menyebut porsinya adalah cara paling mudah salah
              membaca sistem ini. */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-muted-foreground">{data.total} baris:</span>
            {(Object.keys(KELAS_STYLE) as SignalLogKelas[]).map((k) =>
              data.per_kelas[k] ? (
                <span
                  key={k}
                  className={cn(
                    "px-1.5 py-0.5 rounded border font-medium",
                    KELAS_STYLE[k],
                  )}
                >
                  {data.per_kelas[k]} {k}
                </span>
              ) : null,
            )}
            {data.belum_resolusi > 0 && (
              <span className="text-muted-foreground">
                · {data.belum_resolusi} belum diresolusi
              </span>
            )}
            {data.beku > 0 && (
              <span className="inline-flex items-center gap-1 text-yellow-400">
                <AlertTriangle className="w-3 h-3" />
                {data.beku} status beku
              </span>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {data.rows.map((r) => {
              const terbuka = buka === r.id;
              return (
                <div key={r.id}>
                  <button
                    onClick={() => setBuka(terbuka ? null : r.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50 text-left"
                  >
                    {terbuka ? (
                      <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                    )}

                    <span className="font-medium text-sm w-32 truncate">
                      {r.ticker ?? "—"}
                    </span>

                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] border font-medium shrink-0",
                        KELAS_STYLE[r.kelas],
                      )}
                      title={r.kelas_arti}
                    >
                      {r.kelas}
                    </span>

                    <span className="text-xs text-muted-foreground w-16 shrink-0">
                      {r.tier ?? "—"}
                    </span>

                    <span
                      className={cn(
                        "text-xs w-20 shrink-0",
                        OUTCOME_STYLE[r.outcome ?? ""] ?? "text-muted-foreground",
                      )}
                    >
                      {r.outcome ?? "—"}
                    </span>

                    <span className="text-xs tabular-nums w-20 shrink-0 text-muted-foreground">
                      {r.r_multiple == null ? "—" : `${r.r_multiple > 0 ? "+" : ""}${r.r_multiple} R`}
                    </span>

                    {r.status_beku && (
                      <Snowflake
                        className="w-3.5 h-3.5 text-yellow-400 shrink-0"
                        aria-label="status beku"
                      />
                    )}

                    <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
                      {waktu(r.created_at)}
                    </span>
                  </button>

                  {terbuka && (
                    <>
                      <p className="px-4 pb-2 text-[11px] text-muted-foreground">
                        {r.kelas_arti}
                        {r.reason ? ` · ${r.reason}` : ""}
                      </p>
                      <Trail row={r} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
