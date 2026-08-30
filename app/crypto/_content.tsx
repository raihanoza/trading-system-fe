"use client";

import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import {
  SIGNAL_HIDUP,
  type Direction,
  type DirectionsMeta,
  type Signal,
  type ShadowSignal,
} from "@/types";
import SignalCard from "@/components/signals/SignalCard";
import ShadowSignals from "@/components/signals/ShadowSignals";
import RecordTradeDialog from "@/components/signals/RecordTradeDialog";
import ScanButton from "@/components/ui/ScanButton";
import TradingChart from "@/components/charts/TradingChart";
import {
  Zap,
  Radar,
  Loader2,
  Clock,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

/**
 * Halaman crypto menampilkan DUA hal yang berbeda, dan pemisahannya disengaja:
 *
 *   1. **Sinyal hidup** — baris `/signals/crypto` yang statusnya masih
 *      `waiting_entry`/`active`. Inilah yang bisa ditindaklanjuti, dan inilah
 *      yang membawa tombol Track Observation / Record Trade.
 *   2. **Hasil scan barusan** — kandidat yang gugur, ditampilkan supaya
 *      "gate-nya jelek" tidak terlihat sama dengan "scanner mati".
 *
 * Sampai 30 Agustus 2026 halaman ini HANYA menampilkan (2) plus sinyal yang
 * baru terbit di scan itu juga. Akibatnya nyata dan terukur: C3 anti-duplikat
 * memblokir penerbitan ulang setup yang sama selama 7 hari, jadi sesudah scan
 * pertama layar nyaris kosong selama seminggu — 19 sinyal crypto berstatus
 * `active` ada di DB dan tidak satu pun tampil. Pengguna melihat "cuma 1
 * sinyal" sementara sistemnya sedang melacak sembilan belas.
 *
 * Itu juga sebabnya fitur jurnal terasa hilang: Track Observation hidup di
 * dalam `SignalCard`, dan tidak ada `SignalCard` yang pernah dirender.
 */
/** Berapa baris `/signals` yang diminta. Batas server 100. */
const AMBIL = 100;

export default function CryptoContent() {
  // `null` = belum dimuat. `terpotong` menandai bahwa API mengembalikan tepat
  // sebanyak `AMBIL` baris, jadi masih ada sinyal lebih tua yang tidak terlihat
  // — angka di judul harus menyebutkan itu, bukan menyodorkan hitungan yang
  // terbaca sebagai total.
  const [hidup, setHidup] = useState<Signal[] | null>(null);
  const [terpotong, setTerpotong] = useState(false);
  const [terbit, setTerbit] = useState<Signal[]>([]);
  const [shadow, setShadow] = useState<ShadowSignal[]>([]);
  const [chart, setChart] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  // Sinyal yang sedang dicatat. `SignalCard` hanya merender blok
  // Record/Track Observation kalau prop `onTrade` dioper (lihat SignalCard
  // baris ~1172) — tanpa state ini + dialognya di bawah, tombolnya tidak
  // pernah ada. Itulah kenapa halaman ini sempat berbeda dari Overview:
  // Overview mengoper `onTrade`, halaman pasar tidak.
  const [tradeSig, setTradeSig] = useState<Signal | null>(null);
  const [arah, setArah] = useState<Direction>("LONG");
  // Dari `/meta/directions`. Tanpa ini tab SHORT yang kosong tidak bisa
  // membedakan "sakelarnya mati" dari "menyala tapi hari ini nihil kandidat" —
  // dua sebab yang menuntut tindakan berbeda.
  const [meta, setMeta] = useState<DirectionsMeta | null>(null);

  const ambilHidup = useCallback(async (): Promise<{
    rows: Signal[];
    terpotong: boolean;
  }> => {
    try {
      const rows = await api.signals.byMarket("crypto", AMBIL);
      // `status` absen pada sinyal lama (sebelum siklus hidup 4.3) — dianggap
      // hidup, bukan dibuang: membuangnya menyembunyikan setup yang mungkin
      // masih berjalan.
      return {
        rows: rows.filter(
          (s) => s.status === undefined || SIGNAL_HIDUP.includes(s.status),
        ),
        terpotong: rows.length >= AMBIL,
      };
    } catch {
      // Daftar sinyal hidup gagal diambil TIDAK boleh menjatuhkan tombol scan.
      return { rows: [], terpotong: false };
    }
  }, []);

  useEffect(() => {
    let alive = true;
    api.meta
      .directions()
      .then((m) => {
        if (alive) setMeta(m);
      })
      .catch(() => {});
    ambilHidup().then((r) => {
      if (!alive) return;
      setHidup(r.rows);
      setTerpotong(r.terpotong);
    });
    return () => {
      alive = false;
    };
  }, [ambilHidup]);

  const scan = useCallback(async () => {
    const r = await api.scan.crypto();
    setTerbit(r.signals as Signal[]);
    setShadow(r.shadow_signals ?? []);
    setScanned(true);
    // Yang baru terbit langsung jadi bagian dari "hidup" — dibaca ulang dari
    // server, bukan digabung di klien, supaya id dan status datang dari satu
    // sumber saja.
    const h = await ambilHidup();
    setHidup(h.rows);
    setTerpotong(h.terpotong);
    return r;
  }, [ambilHidup]);

  // Yang baru terbit sudah ikut terbaca di `hidup` setelah muat ulang; daftar
  // `terbit` hanya dipakai untuk MENANDAI mana yang baru, bukan dirender dua
  // kali.
  const idBaru = new Set(terbit.map((s) => s.id));
  // Dipisah, bukan disaring: baris beku TETAP ditampilkan (membuangnya
  // menyembunyikan setup yang mungkin masih terbuka), tapi tidak boleh berdiri
  // di antara sinyal segar seolah statusnya sama-sama mutakhir.
  const semua = (hidup ?? []).filter((s) => s.direction === arah);
  const daftar = semua.filter((s) => s.lifecycle_tracked !== false);
  const beku = semua.filter((s) => s.lifecycle_tracked === false);
  const shadowArah = shadow.filter((s) => s.direction === arah);

  // Cacah per arah untuk label tab — dihitung dari SELURUH daftar, bukan dari
  // yang sedang tersaring.
  const cacah = (d: Direction) =>
    (hidup ?? []).filter(
      (s) => s.direction === d && s.lifecycle_tracked !== false,
    ).length;

  const shortMati = meta ? !meta.short_enabled : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ScanButton label="Scan Crypto" onScan={scan} variant="primary" />
        <span className="text-xs text-muted-foreground">
          Scans every 4 hours automatically
        </span>
      </div>

      {/* ── Tab arah ─────────────────────────────────────────────────────────
          Dipisah per arah karena LONG dan SHORT adalah dua tesis yang
          berlawanan di instrumen yang sama — menumpuknya dalam satu daftar
          membuat dua kartu yang saling membatalkan tampil bersebelahan seolah
          dua peluang. Angka di tab = sinyal HIDUP arah itu; bagian di dalamnya
          punya cacahnya sendiri. */}
      <div className="flex gap-2">
        {(["LONG", "SHORT"] as const).map((d) => {
          const aktif = arah === d;
          const Ikon = d === "LONG" ? TrendingUp : TrendingDown;
          return (
            <button
              key={d}
              onClick={() => setArah(d)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                aktif
                  ? d === "LONG"
                    ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/25"
                    : "bg-rose-500/15 text-rose-500 border border-rose-500/25"
                  : "text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              <Ikon className="w-3.5 h-3.5" />
              {d} ({cacah(d)})
              {d === "SHORT" && shortMati && (
                <span
                  className="ml-1 rounded px-1 py-0.5 text-[9px] uppercase tracking-wide border border-border text-muted-foreground/70"
                  title="SHORT_ENABLED=0 — backend tidak memindai arah ini."
                >
                  mati
                </span>
              )}
            </button>
          );
        })}
      </div>

      {chart && (
        <TradingChart
          market="crypto"
          ticker={chart}
          interval="4h"
          height={380}
        />
      )}

      {/* ── Sinyal hidup ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Radar className="w-3.5 h-3.5 text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            Sinyal hidup {arah}{" "}
            {hidup === null
              ? ""
              : terpotong
                ? `(${daftar.length} dari ${AMBIL} sinyal terbaru)`
                : `(${daftar.length})`}
          </h2>
        </div>
        <p className="text-xs text-muted-foreground/70">
          Setup yang masih berjalan — menunggu entry atau sudah aktif. Di sinilah
          tombol <strong>Track Observation</strong> (RADAR) dan{" "}
          <strong>Record Trade</strong> berada. Bukan hanya hasil scan barusan:
          setup yang terbit beberapa hari lalu tetap dilacak dan tidak
          diterbitkan ulang selama 7 hari.
        </p>

        {hidup === null ? (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Memuat sinyal hidup…
          </div>
        ) : daftar.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border border-border rounded-xl bg-card/40">
            <Zap className="w-8 h-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {arah === "SHORT" && shortMati
                ? "Arah SHORT tidak dipindai"
                : `Tidak ada sinyal ${arah} crypto yang sedang hidup`}
            </p>
            {/* Kosong karena SAKELAR dan kosong karena TIDAK ADA KANDIDAT
                menuntut tindakan yang berbeda, jadi kalimatnya harus berbeda.
                Sebelum `/meta/directions` ada, keduanya tampil identik. */}
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-lg text-center px-4">
              {arah === "SHORT" && shortMati ? (
                <>
                  <code>SHORT_ENABLED=0</code> — backend tidak menganalisis arah
                  ini sama sekali, jadi bukan berarti tidak ada setup. Sakelarnya
                  dimatikan setelah pengukuran 28 Agustus 2026: expectancy SHORT
                  −0,057 R vs LONG −0,103 R (SHORT lebih baik), tapi selang
                  kepercayaan selisihnya memuat nol — jadi bedanya tidak bisa
                  dibedakan dari kebetulan.
                </>
              ) : scanned && shadowArah.length > 0 ? (
                `Scan barusan menganalisis ${shadowArah.length} kandidat ${arah} dan tidak satu pun lolos — semuanya ada di bawah beserta alasannya.`
              ) : (
                "Jalankan scan untuk mencari setup."
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {daftar.map((s) => (
              <div
                key={s.id}
                onClick={(e) => {
                  // Klik pada kartu membuka chart, TAPI klik pada kontrol di
                  // dalamnya (Track Observation, checklist, "lihat") tidak
                  // boleh ikut memindah chart — sebelum penjaga ini, menekan
                  // Record juga menggeser chart di belakang dialognya.
                  if ((e.target as HTMLElement).closest("button")) return;
                  setChart(s.ticker);
                }}
                className="cursor-pointer relative"
              >
                {idBaru.has(s.id) && (
                  <span className="absolute -top-1.5 -right-1.5 z-10 rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                    baru
                  </span>
                )}
                <SignalCard signal={s} onTrade={setTradeSig} />
              </div>
            ))}
          </div>
        )}
      </div>

      {beku.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <h2 className="text-sm font-semibold">
              Status beku {arah} ({beku.length})
            </h2>
          </div>
          <p className="text-xs text-muted-foreground/70">
            Sinyal ini masih tercatat <code>active</code>, tapi umurnya sudah
            melewati jendela pelacak siklus hidup — jadi statusnya{" "}
            <strong>tidak diperbarui lagi</strong> dan tidak akan pernah jadi
            hit TP / hit SL / expired dengan sendirinya. Ditampilkan apa adanya:
            membuangnya menyembunyikan setup yang mungkin masih terbuka,
            sedangkan menaruhnya di daftar atas akan mengaku sebagai kabar
            terbaru.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 opacity-60">
            {/* SENGAJA tanpa `onTrade`: level di baris ini berumur lebih dari
                sebulan dan statusnya tidak diperbarui lagi. Menawarkan Record
                di sini berarti mengajak mencatat posisi pada harga yang sudah
                lama tidak berlaku. Kalau memang mau dicatat, buka sinyalnya
                dari halaman Journal. */}
            {beku.map((s) => (
              <div
                key={s.id}
                onClick={() => setChart(s.ticker)}
                className="cursor-pointer"
              >
                <SignalCard signal={s} />
              </div>
            ))}
          </div>
        </div>
      )}

      <ShadowSignals shadow={shadowArah} />

      {/* Dialog Record / Track Observation. Dirender sekali di sini, bukan per
          kartu — sama seperti Overview. `onDone` memuat ulang daftar supaya
          status sinyal yang baru dicatat langsung ikut terbarui. */}
      <RecordTradeDialog
        signal={tradeSig}
        onClose={() => setTradeSig(null)}
        onDone={() => {
          setTradeSig(null);
          ambilHidup().then((h) => {
            setHidup(h.rows);
            setTerpotong(h.terpotong);
          });
        }}
      />
    </div>
  );
}
