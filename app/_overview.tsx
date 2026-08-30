"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, DollarSign, Activity, Target, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { formatIDR } from "@/lib/utils";
import type { ScanResponse, ShadowSignal, Signal, Stats } from "@/types";
import StatCard from "@/components/ui/StatCard";
import SignalCard from "@/components/signals/SignalCard";
import ShadowSignals from "@/components/signals/ShadowSignals";
import ScanButton from "@/components/ui/ScanButton";
import RecordTradeDialog from "@/components/signals/RecordTradeDialog";

/** Hasil satu penekanan tombol scan — apa yang RUN ITU hasilkan. */
type ScanResult = {
  published: Signal[];
  shadow: ShadowSignal[];
  /** Market yang request-nya gagal. Kosong bukan berarti aman. */
  failed: string[];
};

export default function OverviewContent() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeSig, setTradeSig] = useState<Signal | null>(null);

  // Hasil scan terakhir dari halaman ini. Dipisah dari `signals` (riwayat DB)
  // dengan sengaja — lihat catatan di `runScan`.
  const [scan, setScan] = useState<ScanResult | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sig] = await Promise.all([api.stats(), api.signals.all(12)]);
      setStats(s);
      setSignals(sig);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Jalankan beberapa scan dan tampilkan APA YANG SCAN ITU HASILKAN.
   *
   * Sampai 26 Agustus 2026 tombol di halaman ini membuang respons scan-nya
   * dan hanya memanggil `loadData()`, yang membaca `GET /signals` — 12 baris
   * terakhir di DB, umur berapa pun. Akibatnya:
   *
   * - Scan yang menerbitkan NOL tampil identik dengan scan yang menerbitkan
   *   tiga: kartu di bawah tetap terisi, dari database.
   * - Sinyal 24 Mei 2026 duduk di bawah tombol "Scan All" seolah-olah baru
   *   saja ditemukan.
   * - `shadow_signals` dibuang seluruhnya — padahal `ShadowSignals` dibuat
   *   khusus supaya "gate-nya jelek" dan "scanner mati" berhenti tampil sama.
   * - Market yang request-nya GAGAL hilang tanpa jejak dari angka total.
   *
   * Riwayat DB tetap ditampilkan, tapi di bagiannya sendiri dan dengan label
   * yang jujur.
   */
  const runScan = async (
    jobs: [string, () => Promise<ScanResponse>][],
  ): Promise<{ signals_found: number; message: string }> => {
    const settled = await Promise.allSettled(jobs.map(([, run]) => run()));

    const published: Signal[] = [];
    const shadow: ShadowSignal[] = [];
    const failed: string[] = [];

    settled.forEach((r, i) => {
      if (r.status !== "fulfilled") {
        failed.push(jobs[i][0]);
        return;
      }
      published.push(...(r.value.signals ?? []));
      shadow.push(...(r.value.shadow_signals ?? []));
    });

    setScan({ published, shadow, failed });
    await loadData();

    const parts = [`${published.length} diterbitkan`];
    if (shadow.length) parts.push(`${shadow.length} tidak diterbitkan`);
    if (failed.length) parts.push(`${failed.length} market gagal`);

    return {
      signals_found: published.length,
      message:
        parts.join(" · ") +
        (failed.length ? ` (${failed.join(", ")})` : ""),
    };
  };

  const scanAll = () =>
    runScan([
      ["Stock", api.scan.stockAll],
      ["Crypto", api.scan.crypto],
      ["Forex", api.scan.forex],
    ]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Win Rate"
          value={stats ? `${stats.win_rate_pct}%` : "—"}
          sub={`${stats?.total_trades ?? 0} trades`}
          icon={Target}
          trend={stats && stats.win_rate_pct >= 50 ? "up" : "down"}
          loading={loading}
        />
        <StatCard
          label="Total P&L"
          value={stats ? formatIDR(stats.total_pnl_idr) : "—"}
          sub="All time"
          icon={DollarSign}
          trend={stats && stats.total_pnl_idr >= 0 ? "up" : "down"}
          loading={loading}
        />
        <StatCard
          label="Daily P&L"
          value={stats ? formatIDR(stats.daily_pnl_idr) : "—"}
          sub="Today"
          icon={TrendingUp}
          trend={stats && stats.daily_pnl_idr >= 0 ? "up" : "down"}
          loading={loading}
        />
        <StatCard
          label="Open Positions"
          value={stats ? String(stats.open_positions) : "—"}
          sub="Active"
          icon={Activity}
          loading={loading}
        />
      </div>

      {/* Scan controls */}
      <div className="flex flex-wrap items-center gap-2">
        <ScanButton label="Scan All" onScan={scanAll} variant="primary" />
        <ScanButton
          label="IDX 🇮🇩"
          onScan={() => runScan([["IDX", api.scan.stockIdx]])}
        />
        <ScanButton
          label="US 🇺🇸"
          onScan={() => runScan([["US", api.scan.stockUs]])}
        />
        <ScanButton
          label="Crypto"
          onScan={() => runScan([["Crypto", api.scan.crypto]])}
        />
        <ScanButton
          label="Forex"
          onScan={() => runScan([["Forex", api.scan.forex]])}
        />
      </div>

      {/* Hasil scan barusan — terpisah dari riwayat DB di bawahnya, karena
          keduanya menjawab pertanyaan yang berbeda: "apa yang barusan
          ditemukan" vs "apa yang tersimpan". */}
      {scan && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Hasil scan barusan
            </h2>
            <span className="text-xs text-muted-foreground">
              {scan.published.length} diterbitkan
            </span>
          </div>

          {scan.failed.length > 0 && (
            <p className="text-xs text-amber-500 border border-amber-500/30 bg-amber-500/10 rounded-lg px-3 py-2">
              Gagal dijalankan: {scan.failed.join(", ")}. Angka di bawah{" "}
              <strong>tidak</strong> mencakup market itu.
            </p>
          )}

          {scan.published.length === 0 ? (
            <p className="text-xs text-muted-foreground border border-border rounded-lg px-3 py-2 bg-card/40">
              Tidak ada yang lolos tangga tier di scan ini
              {scan.shadow.length > 0
                ? ` — ${scan.shadow.length} kandidat ada di bawah.`
                : "."}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {scan.published.map((s) => (
                <SignalCard
                  key={`scan-${s.id ?? s.ticker}`}
                  signal={s}
                  onTrade={setTradeSig}
                />
              ))}
            </div>
          )}

          <ShadowSignals shadow={scan.shadow} />
        </div>
      )}

      {/* Riwayat DB. Bukan hasil scan barusan — umurnya bisa berbulan-bulan,
          dan itu sebabnya kartunya menampilkan umur. */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-foreground">
            Sinyal tersimpan
          </h2>
          <span className="text-xs text-muted-foreground">
            {signals.length} signals
          </span>
        </div>
        <p className="text-xs text-muted-foreground/70 mb-3">
          12 terakhir di database, umur berapa pun — bukan keluaran scan
          barusan.
        </p>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-xl border border-border shimmer"
              />
            ))}
          </div>
        ) : signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-border rounded-xl bg-card/40">
            <Clock className="w-8 h-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Belum ada sinyal tersimpan — jalankan scan
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {signals.map((s) => (
              <SignalCard key={s.id} signal={s} onTrade={setTradeSig} />
            ))}
          </div>
        )}
      </div>

      {/* Record trade dialog */}
      <RecordTradeDialog
        signal={tradeSig}
        onClose={() => setTradeSig(null)}
        onDone={loadData}
      />
    </div>
  );
}
