"use client";

import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { SIGNAL_HIDUP, type Signal, type ShadowSignal } from "@/types";
import SignalCard from "@/components/signals/SignalCard";
import ShadowSignals from "@/components/signals/ShadowSignals";
import RecordTradeDialog from "@/components/signals/RecordTradeDialog";
import ScanButton from "@/components/ui/ScanButton";
import TradingChart from "@/components/charts/TradingChart";
import { Search, Clock } from "lucide-react";

/** Berapa baris `/signals` yang diminta. Batas server 100. */
const AMBIL = 100;

export default function StockContent() {
  const [signals, setSignals] = useState<Signal[]>([]);
  // Sinyal TERSIMPAN yang masih berjalan — bukan hanya hasil scan barusan.
  // Alasannya sama dengan crypto & forex: C3 memblokir penerbitan ulang setup
  // yang sama selama 7 hari, jadi halaman yang cuma merender keluaran scan
  // tampak kosong berhari-hari sementara sistem masih melacak setup.
  const [hidup, setHidup] = useState<Signal[] | null>(null);
  // `SignalCard` hanya merender blok Record/Track Observation kalau `onTrade`
  // dioper.
  const [tradeSig, setTradeSig] = useState<Signal | null>(null);
  const [shadow, setShadow] = useState<ShadowSignal[]>([]);
  const [activeTab, setActiveTab] = useState<"idx" | "us">("idx");
  const [scanned, setScanned] = useState(false);
  const [search, setSearch] = useState("");
  const [chartTicker, setChartTicker] = useState<{
    ticker: string;
    market: string;
  } | null>(null);

  const ambilHidup = useCallback(async (): Promise<Signal[]> => {
    try {
      // Dua submarket, satu tabel: `/signals/stock` memuat IDX dan US, dan
      // `inView` di bawah yang memisahkannya per tab.
      const rows = await api.signals.byMarket("stock", AMBIL);
      return rows.filter(
        (s) => s.status === undefined || SIGNAL_HIDUP.includes(s.status),
      );
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    let alive = true;
    ambilHidup().then((rows) => {
      if (alive) setHidup(rows);
    });
    return () => {
      alive = false;
    };
  }, [ambilHidup]);

  const scanIDX = useCallback(async () => {
    const r = await api.scan.stockIdx();
    setSignals(r.signals as Signal[]);
    setShadow(r.shadow_signals ?? []);
    setScanned(true);
    setActiveTab("idx");
    setHidup(await ambilHidup());
    return r;
  }, [ambilHidup]);

  const scanUS = useCallback(async () => {
    const r = await api.scan.stockUs();
    setSignals(r.signals as Signal[]);
    setShadow(r.shadow_signals ?? []);
    setScanned(true);
    setActiveTab("us");
    setHidup(await ambilHidup());
    return r;
  }, [ambilHidup]);

  // Satu penyaring untuk sinyal dan baris shadow — kalau keduanya berbeda,
  // tab IDX bisa menampilkan kandidat US tanpa ada yang menyadarinya.
  const inView = (s: { submarket?: string; ticker: string }) =>
    // `?.` bukan gaya-gayaan: baris `/signals` sempat TIDAK punya `submarket`
    // (kolomnya turunan, bukan kolom DB) dan seluruh halaman ini mati karena
    // itu. Backend sudah disamakan, tapi pagar di sisi pembaca tetap dipasang —
    // satu field yang absen tidak boleh menjatuhkan halaman.
    s.submarket?.toLowerCase() === activeTab &&
    (search === "" || s.ticker.toLowerCase().includes(search.toLowerCase()));

  // Yang dirender adalah KEADAAN (sinyal hidup), bukan keluaran scan terakhir.
  // `signals` dari respons scan tinggal dipakai menandai mana yang baru.
  const semua = (hidup ?? []).filter(inView);
  const filtered = semua.filter((s) => s.lifecycle_tracked !== false);
  const beku = semua.filter((s) => s.lifecycle_tracked === false);
  const idBaru = new Set(signals.map((s) => s.id));
  const filteredShadow = shadow.filter(inView);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <ScanButton
          label="Scan IDX 🇮🇩"
          onScan={scanIDX}
          variant={activeTab === "idx" ? "primary" : "secondary"}
        />
        <ScanButton
          label="Scan US 🇺🇸"
          onScan={scanUS}
          variant={activeTab === "us" ? "primary" : "secondary"}
        />

        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticker..."
            className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 w-44"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["idx", "us"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab
                ? "bg-primary/15 text-primary border border-primary/25"
                : "text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            {tab === "idx" ? "🇮🇩 IDX" : "🇺🇸 US"} (
            {
              // Dihitung dari sinyal HIDUP, bukan dari hasil scan terakhir.
              // Sampai 30 Agu 2026 angkanya dari `signals` (keluaran scan), jadi
              // sesudah halaman ini mulai merender keadaan, tab menulis "(0)"
              // tepat di atas sepuluh kartu yang sedang tampil.
              (hidup ?? []).filter(
                (s) =>
                  s.submarket?.toLowerCase() === tab &&
                  s.lifecycle_tracked !== false,
              ).length
            }
            )
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartTicker && (
        <TradingChart
          market={chartTicker.market}
          ticker={chartTicker.ticker}
          interval="1d"
          height={380}
        />
      )}

      {/* Signals grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-border rounded-xl bg-card/40">
          <p className="text-sm text-muted-foreground">
            {scanned && filteredShadow.length > 0
              ? `Tidak ada ${activeTab.toUpperCase()} yang diterbitkan`
              : `No ${activeTab.toUpperCase()} signals`}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-md text-center px-4">
            {scanned && filteredShadow.length > 0
              ? `${filteredShadow.length} kandidat dianalisis penuh tapi gugur — semuanya ada di bawah beserta alasannya.`
              : "Run a scan to find setups"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              onClick={(e) => {
                // Klik kartu membuka chart, tapi klik kontrol di dalamnya
                // (Track Observation, checklist) tidak boleh ikut memindahnya.
                if ((e.target as HTMLElement).closest("button")) return;
                setChartTicker({ ticker: s.ticker, market: s.market });
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

      {beku.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Status beku ({beku.length})</h2>
          </div>
          <p className="text-xs text-muted-foreground/70">
            Masih tercatat <code>active</code>, tapi umurnya melewati jendela
            pelacak siklus hidup — statusnya{" "}
            <strong>tidak diperbarui lagi</strong>. SENGAJA tanpa tombol Record:
            levelnya sudah lama tidak berlaku.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 opacity-60">
            {beku.map((s) => (
              <div
                key={s.id}
                onClick={() =>
                  setChartTicker({ ticker: s.ticker, market: s.market })
                }
                className="cursor-pointer"
              >
                <SignalCard signal={s} />
              </div>
            ))}
          </div>
        </div>
      )}

      <ShadowSignals shadow={filteredShadow} />

      <RecordTradeDialog
        signal={tradeSig}
        onClose={() => setTradeSig(null)}
        onDone={() => {
          setTradeSig(null);
          ambilHidup().then(setHidup);
        }}
      />
    </div>
  );
}
