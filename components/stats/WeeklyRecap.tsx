"use client";

/**
 * D7 — rekap mingguan + satu fokus perbaikan.
 *
 * Dua keputusan tampilan yang sengaja:
 *
 * 1. **Kartu ini dirender di ATAS pagar "belum ada trade"** di halaman stats.
 *    Justru saat belum ada apa-apa, rekap ini paling berguna: fokusnya akan
 *    berbunyi "mesinnya tidak berjalan" atau "jurnal tidak dipakai" — dua hal
 *    yang tidak akan pernah terlihat kalau kartunya ikut disembunyikan bersama
 *    statistik trade.
 * 2. **`fokus: null` ditampilkan apa adanya**, bukan disembunyikan. "Tidak ada
 *    yang perlu diperbaiki minggu ini" adalah jawaban, dan menyembunyikannya
 *    membuat kolom fokus hanya pernah terlihat saat ada masalah — yang
 *    mengajarkan bahwa sistem selalu punya keluhan.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Hitung {
  n: number;
  win: number;
  loss: number;
  expired: number;
  pending: number;
  decided: number;
  win_rate: number | null;
}

interface Fokus {
  kode: string;
  judul: string;
  kalimat: string;
  tindakan: string;
  angka: Record<string, unknown>;
}

interface Recap {
  jendela: { mulai: string; sampai: string; hari: number };
  minggu_ini: Hitung;
  minggu_lalu: Hitung;
  perubahan: {
    sinyal: number;
    cukup_untuk_dibandingkan: boolean;
    winrate_pp: number | null;
    kenapa_null?: string;
  };
  scan: { total: number; sukses: number };
  jurnal: {
    trade_ditutup: number;
    menyimpang: number;
    temuan: Record<string, number>;
  };
  fokus: Fokus | null;
  catatan: string;
}

const FOKUS_WARNA: Record<string, string> = {
  mesin_mati: "border-destructive/30 bg-destructive/5 text-destructive",
  jurnal_kosong: "border-warning/30 bg-warning/5 text-warning",
  eksekusi_menyimpang: "border-warning/30 bg-warning/5 text-warning",
  sampel_kurang: "border-border bg-secondary/40 text-muted-foreground",
};

function Angka({
  label,
  nilai,
  sub,
}: {
  label: string;
  nilai: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold font-mono">{nilai}</p>
      {sub && (
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">{sub}</p>
      )}
    </div>
  );
}

export default function WeeklyRecap({ market = "all" }: { market?: string }) {
  const [data, setData] = useState<Recap | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tidak ada setState sinkron di badan efek: selain melanggar aturan lint,
  // `batal` di sini mencegah respons market lama menimpa market baru kalau
  // pengguna berganti tab lebih cepat daripada jaringannya.
  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const r = await fetch(`${API}/analytics/weekly-recap?market=${market}`);
        if (!r.ok) throw new Error(`API ${r.status}`);
        const json = (await r.json()) as Recap;
        if (!batal) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!batal)
          setError(e instanceof Error ? e.message : "gagal memuat rekap");
      }
    })();
    return () => {
      batal = true;
    };
  }, [market]);

  if (error)
    return (
      <div className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
        Rekap mingguan tidak bisa dimuat ({error}).
      </div>
    );
  if (!data) return <div className="h-40 rounded-xl border border-border shimmer" />;

  const ini = data.minggu_ini;
  const p = data.perubahan;

  return (
    <div className="rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">
          Rekap {data.jendela.hari} hari terakhir
        </h2>
        <span className="text-[11px] text-muted-foreground font-mono">
          {data.jendela.mulai.slice(0, 10)} → {data.jendela.sampai.slice(0, 10)}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Angka
          label="Sinyal terbit"
          nilai={String(ini.n)}
          sub={`minggu lalu ${data.minggu_lalu.n}`}
        />
        <Angka
          label="Teresolusi"
          nilai={String(ini.decided)}
          sub={`${ini.win} menang · ${ini.loss} kalah · ${ini.expired} kedaluwarsa`}
        />
        <Angka
          label="Winrate"
          nilai={ini.win_rate === null ? "—" : `${ini.win_rate}%`}
          sub={
            ini.win_rate === null
              ? "belum ada yang teresolusi"
              : `dari ${ini.decided} sinyal`
          }
        />
        <Angka
          label="Scan sukses"
          nilai={`${data.scan.sukses}/${data.scan.total}`}
          sub={data.scan.sukses === 0 ? "sistem tidak berjalan" : undefined}
        />
      </div>

      {/* Perbandingan antar-minggu — atau penolakan untuk membandingkannya. */}
      <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs">
        {p.cukup_untuk_dibandingkan && p.winrate_pp !== null ? (
          <span>
            Winrate bergerak{" "}
            <span
              className={cn(
                "font-mono font-semibold",
                p.winrate_pp > 0 ? "text-profit" : "text-loss",
              )}
            >
              {p.winrate_pp > 0 ? "+" : ""}
              {p.winrate_pp} pp
            </span>{" "}
            dibanding minggu lalu.
          </span>
        ) : (
          <span className="text-muted-foreground">
            Selisih winrate antar-minggu <strong>tidak ditampilkan</strong>.{" "}
            {p.kenapa_null}
          </span>
        )}
      </div>

      {/* Fokus — termasuk saat tidak ada. */}
      {data.fokus ? (
        <div
          className={cn(
            "rounded-lg border p-3",
            FOKUS_WARNA[data.fokus.kode] ?? "border-border bg-secondary/40",
          )}
        >
          <p className="text-[11px] uppercase tracking-wide opacity-70">
            Fokus minggu ini
          </p>
          <p className="mt-1 text-sm font-semibold">{data.fokus.judul}</p>
          <p className="mt-1 text-xs opacity-90">{data.fokus.kalimat}</p>
          <p className="mt-2 text-xs font-medium">→ {data.fokus.tindakan}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Fokus minggu ini
          </p>
          <p className="mt-1 text-sm">
            Tidak ada. Mesin berjalan, jurnal terpakai, eksekusi sesuai rencana.
          </p>
        </div>
      )}

      {data.jurnal.menyimpang > 0 && (
        <div className="text-xs text-muted-foreground">
          {data.jurnal.menyimpang} dari {data.jurnal.trade_ditutup} trade
          menyimpang dari rencana ·{" "}
          {Object.entries(data.jurnal.temuan)
            .map(([k, v]) => `${k} (${v})`)
            .join(" · ")}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground/70 border-t border-border pt-3">
        {data.catatan}
      </p>
    </div>
  );
}
