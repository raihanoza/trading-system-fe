"use client";

import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { SIGNAL_HIDUP, type Signal, type ShadowSignal } from "@/types";
import SignalCard from "@/components/signals/SignalCard";
import ShadowSignals from "@/components/signals/ShadowSignals";
import RecordTradeDialog from "@/components/signals/RecordTradeDialog";
import ScanButton from "@/components/ui/ScanButton";
import TradingChart from "@/components/charts/TradingChart";
import { DollarSign, Clock, Loader2 } from "lucide-react";

const KILL_ZONES = [
  {
    name: "London",
    time: "14:00 – 17:00 WIB",
    active: () => {
      const h = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Jakarta",
        hour: "numeric",
        hour12: false,
      });
      const hr = parseInt(h);
      return hr >= 14 && hr < 17;
    },
  },
  {
    name: "New York",
    time: "20:30 – 23:00 WIB",
    active: () => {
      const now = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Jakarta",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
      const [h, m] = now.split(":").map(Number);
      const mins = h * 60 + (m || 0);
      return mins >= 1230 && mins < 1380;
    },
  },
];

interface ScanInfo {
  session?: string;
  wib_time?: string;
  message?: string;
  kill_zone?: boolean;
  next?: string;
  // Kenapa engine berhenti sebelum menganalisis apa pun. Lihat ScanResponse.
  blocked?: string | null;
  analyzed?: boolean;
}

/**
 * Teks kosong yang MENJELASKAN, bukan yang menghibur.
 *
 * Sampai 25 Agustus 2026 kotak ini selalu berbunyi "Signals only appear during
 * kill zones" — termasuk saat kill zone sedang AKTIF dan 8 pair barusan
 * dianalisis. Empat keadaan di bawah tampil sama persis waktu itu, padahal
 * hanya satu di antaranya yang berarti tidak ada apa-apa untuk dilihat.
 */
function emptyState(
  info: ScanInfo | null,
  shadowCount: number,
): { title: string; hint: string } {
  if (!info)
    return {
      title: "Belum ada scan",
      hint: "Klik Scan Forex untuk menganalisis 8 major pair.",
    };
  // Diperiksa SEBELUM `kill_zone`: pasar tutup mengalahkan jam. Sabtu 21:43
  // WIB memberi `kill_zone: true` sementara nol pair pernah diambil — sampai
  // 30 Agu 2026 keadaan itu jatuh ke cabang terakhir dan menuduh fetcher
  // ("nol pair kembali dari fetcher — cek /system/heartbeat"), padahal
  // fetchernya tidak pernah dipanggil.
  if (info.blocked)
    return {
      title: "Tidak ada pair yang dianalisis",
      hint:
        `${info.blocked}. Jam ${info.wib_time ?? ""} memang masuk kill zone ` +
        `${info.session ?? ""}, tapi itu jam saja — kosong di sini BUKAN ` +
        `berarti tidak ada setup.`,
    };
  if (info.kill_zone === false)
    return {
      title: `Di luar kill zone — ${info.session ?? "off-hours"}`,
      hint:
        info.next ??
        "Entry baru hanya diterbitkan di sesi London atau New York.",
    };
  if (shadowCount > 0)
    return {
      title: "Tidak ada yang diterbitkan",
      hint: `${shadowCount} kandidat dianalisis penuh tapi gugur — semuanya ada di bawah beserta alasannya.`,
    };
  return {
    title: "Tidak ada kandidat sama sekali",
    hint: `Kill zone ${info.session ?? ""} aktif tapi nol pair kembali dari fetcher — cek /system/heartbeat.`,
  };
}

/** Berapa baris `/signals` yang diminta. Batas server 100. */
const AMBIL = 100;

export default function ForexContent() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [shadow, setShadow] = useState<ShadowSignal[]>([]);
  const [chart, setChart] = useState<string | null>(null);
  const [scanInfo, setScanInfo] = useState<ScanInfo | null>(null);
  // Sinyal yang TERSIMPAN dan masih berjalan — bukan hanya hasil scan barusan.
  // Alasan lengkapnya sama dengan halaman crypto: C3 memblokir penerbitan ulang
  // setup yang sama selama 7 hari, jadi halaman yang hanya merender keluaran
  // scan akan tampak kosong berhari-hari sementara sistem masih melacak setup.
  const [hidup, setHidup] = useState<Signal[] | null>(null);
  // `SignalCard` hanya merender blok Record/Track Observation kalau `onTrade`
  // dioper. Tanpa state ini + dialognya, tombolnya tidak pernah ada.
  const [tradeSig, setTradeSig] = useState<Signal | null>(null);

  const ambilHidup = useCallback(async (): Promise<{ rows: Signal[] }> => {
    try {
      const rows = await api.signals.byMarket("forex", AMBIL);
      return {
        rows: rows.filter(
          (s) => s.status === undefined || SIGNAL_HIDUP.includes(s.status),
        ),
      };
    } catch {
      return { rows: [] };
    }
  }, []);

  useEffect(() => {
    let alive = true;
    ambilHidup().then((r) => {
      if (alive) setHidup(r.rows);
    });
    return () => {
      alive = false;
    };
  }, [ambilHidup]);

  const scan = useCallback(async () => {
    const r = await api.scan.forex();
    setSignals(r.signals as Signal[]);
    setShadow(r.shadow_signals ?? []);
    setScanInfo({
      session: r.session,
      wib_time: r.wib_time,
      message: r.message,
      kill_zone: r.kill_zone,
      next: r.next,
      blocked: r.blocked,
      analyzed: r.analyzed,
    });
    const h = await ambilHidup();
    setHidup(h.rows);
    return r;
  }, [ambilHidup]);

  const empty = emptyState(scanInfo, shadow.length);
  // Dipisah, bukan disaring: baris yang statusnya BEKU (di luar jendela
  // pelacak siklus hidup) tetap ditampilkan, tapi tidak boleh berdiri di antara
  // sinyal segar seolah sama-sama mutakhir. Lihat LIFECYCLE_WINDOW_DAYS.
  const semua = hidup ?? [];
  const daftarHidup = semua.filter((s) => s.lifecycle_tracked !== false);
  const beku = semua.filter((s) => s.lifecycle_tracked === false);

  return (
    <div className="space-y-6">
      {/* Kill zone status */}
      <div className="grid grid-cols-2 gap-3">
        {KILL_ZONES.map((kz) => {
          const active = kz.active();
          return (
            <div
              key={kz.name}
              className={`rounded-xl border p-3 ${active ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${active ? "bg-primary animate-pulse-dot" : "bg-muted-foreground/30"}`}
                />
                <span
                  className={`text-xs font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
                >
                  {kz.name} Kill Zone
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {kz.time}
              </p>
              {active && (
                <p className="text-xs text-primary mt-1 font-medium">
                  Active now
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <ScanButton label="Scan Forex" onScan={scan} variant="primary" />
        {scanInfo?.wib_time && (
          <span className="text-xs text-muted-foreground font-mono">
            {scanInfo.wib_time}
          </span>
        )}
      </div>

      {scanInfo?.message && (
        <div className="px-4 py-3 rounded-lg bg-secondary/50 border border-border text-xs text-muted-foreground">
          {scanInfo.message}
        </div>
      )}

      {chart && (
        <TradingChart
          market="forex"
          ticker={chart}
          interval="1h"
          height={380}
        />
      )}

      {/* ── Sinyal hidup ─────────────────────────────────────────────────────
          Sumbernya `/signals/forex`, bukan hasil scan barusan. `signals` dari
          respons scan hanya dipakai MENANDAI mana yang baru terbit. */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">
          Sinyal hidup {hidup === null ? "" : `(${daftarHidup.length})`}
        </h2>
        <p className="text-xs text-muted-foreground/70">
          Setup yang masih berjalan. Di sinilah tombol{" "}
          <strong>Track Observation</strong> (RADAR) dan{" "}
          <strong>Record Trade</strong> berada.
        </p>

        {hidup === null ? (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Memuat sinyal hidup…
          </div>
        ) : daftarHidup.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-border rounded-xl bg-card/40">
            <DollarSign className="w-8 h-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">{empty.title}</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-md text-center px-4">
              {empty.hint}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {daftarHidup.map((s) => (
              <div
                key={s.id}
                onClick={(e) => {
                  // Klik kartu membuka chart, tapi klik kontrol di dalamnya
                  // (Track Observation, checklist) tidak boleh ikut memindah
                  // chart di belakang dialognya.
                  if ((e.target as HTMLElement).closest("button")) return;
                  setChart(s.ticker);
                }}
                className="cursor-pointer relative"
              >
                {signals.some((n) => n.id === s.id) && (
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
            <h2 className="text-sm font-semibold">Status beku ({beku.length})</h2>
          </div>
          <p className="text-xs text-muted-foreground/70">
            Masih tercatat <code>active</code>, tapi umurnya sudah melewati
            jendela pelacak siklus hidup — statusnya{" "}
            <strong>tidak diperbarui lagi</strong>. Ditampilkan apa adanya, dan
            SENGAJA tanpa tombol Record: levelnya sudah lama tidak berlaku.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 opacity-60">
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

      <ShadowSignals shadow={shadow} />

      <RecordTradeDialog
        signal={tradeSig}
        onClose={() => setTradeSig(null)}
        onDone={() => {
          setTradeSig(null);
          ambilHidup().then((h) => setHidup(h.rows));
        }}
      />
    </div>
  );
}
