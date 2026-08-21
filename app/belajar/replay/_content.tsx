"use client";

/**
 * D8 — mode replay (flight simulator).
 *
 * Aturan yang menentukan seluruh rancangan halaman ini: **klien tidak boleh
 * pernah memegang bar setelah kursor.** Karena itu:
 *
 *  • bar diminta ulang dari server tiap kursor maju — tidak ada cache "seluruh
 *    deret" yang tinggal digeser;
 *  • chart-nya komponen sendiri yang tidak pernah mengambil data
 *    (`components/charts/TradingChart.tsx` mengambil deret penuh — memakainya
 *    di sini akan membocorkan masa depan lewat pintu belakang);
 *  • hasil sebuah keputusan hanya bisa diminta lewat `/score`, yang menuntut
 *    keputusannya dikirim lebih dulu.
 *
 * Sesi disimpan di klien saja. Skor latihan bukan data pengukuran sistem, dan
 * mencampurnya ke DB yang sama dengan sinyal/trade akan mengaburkan mana yang
 * hasil sistem dan mana yang skor permainan.
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import ReplayChart, { type Bar } from "./_chart";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface StateResp {
  cursor: number;
  bars: Bar[];
  harga: number | null;
  waktu: string | null;
  ada_lagi: boolean;
}

interface Hasil {
  cursor: number;
  aksi: string;
  outcome: string;
  pnl_r: number | null;
  bars_held: number;
  fill?: number;
  exit_price?: number;
  catatan: string;
}

interface Ringkasan {
  keputusan: number;
  diambil: number;
  dilewati: number;
  dinilai: number;
  menang: number;
  expectancy_r: number | null;
  win_rate: number | null;
  bisa_disimpulkan: boolean;
  catatan?: string;
}

const PASAR = [
  { value: "stock_idx", label: "IDX", ticker: "BBCA.JK", interval: "1d" },
  { value: "stock_us", label: "US", ticker: "NVDA", interval: "1d" },
  { value: "crypto", label: "Crypto", ticker: "BTCUSDT", interval: "4h" },
];

const OUTCOME_STYLE: Record<string, string> = {
  win: "text-profit",
  loss: "text-loss",
  expired: "text-warning",
  batal: "text-muted-foreground",
  skip: "text-muted-foreground",
  pending: "text-muted-foreground",
};

export default function ReplayContent() {
  const [pasar, setPasar] = useState(PASAR[0]);
  const [cursor, setCursor] = useState(80);
  const [data, setData] = useState<StateResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [hasil, setHasil] = useState<Hasil[]>([]);
  const [ringkas, setRingkas] = useState<Ringkasan | null>(null);

  // Bar SELALU diminta ulang dari server — tidak ada deret penuh di klien.
  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const r = await fetch(
          `${API}/replay/${pasar.value}/${pasar.ticker}` +
            `?interval=${pasar.interval}&cursor=${cursor}`,
        );
        if (!r.ok) throw new Error((await r.text()).slice(0, 120));
        const json = (await r.json()) as StateResp;
        if (!batal) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!batal) setError(e instanceof Error ? e.message : "gagal memuat");
      }
    })();
    return () => {
      batal = true;
    };
  }, [pasar, cursor]);

  const kirim = useCallback(
    async (aksi: "BUY" | "SKIP") => {
      if (!data) return;
      setSibuk(true);
      try {
        const body =
          aksi === "SKIP"
            ? { cursor, aksi }
            : {
                cursor,
                aksi,
                entry: data.harga,
                stop_loss: parseFloat(sl),
                take_profit: parseFloat(tp),
              };
        const r = await fetch(
          `${API}/replay/${pasar.value}/${pasar.ticker}/score?interval=${pasar.interval}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (!r.ok) throw new Error((await r.text()).slice(0, 160));
        const h = (await r.json()) as Hasil;
        const daftar = [h, ...hasil];
        setHasil(daftar);
        setSl("");
        setTp("");
        // Lompat melewati bar yang sudah "terpakai" oleh trade barusan supaya
        // keputusan berikutnya tidak tumpang tindih dengan yang baru dinilai.
        setCursor((c) => c + Math.max(1, h.bars_held || 1));

        const rs = await fetch(`${API}/replay/summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hasil: daftar }),
        });
        if (rs.ok) setRingkas((await rs.json()) as Ringkasan);
      } catch (e) {
        setError(e instanceof Error ? e.message : "gagal menilai");
      } finally {
        setSibuk(false);
      }
    },
    [cursor, data, hasil, pasar, sl, tp],
  );

  const buyValid =
    data?.harga != null &&
    !isNaN(parseFloat(sl)) &&
    !isNaN(parseFloat(tp)) &&
    parseFloat(sl) < data.harga &&
    parseFloat(tp) > data.harga;

  return (
    <div className="space-y-5">
      {/* Pemilih instrumen */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PASAR.map((p) => (
          <button
            key={p.value}
            onClick={() => {
              setPasar(p);
              setCursor(80);
              setHasil([]);
              setRingkas(null);
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              pasar.value === p.value
                ? "bg-primary/15 text-primary border-primary/25"
                : "text-muted-foreground border-border hover:text-foreground",
            )}
          >
            {p.label} · {p.ticker}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Chart — hanya bar sampai kursor */}
      <div className="rounded-xl border border-border overflow-hidden">
        <ReplayChart
          bars={data?.bars ?? []}
          levels={
            buyValid && data?.harga != null
              ? {
                  entry: data.harga,
                  stop_loss: parseFloat(sl),
                  take_profit: parseFloat(tp),
                }
              : null
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs">
          <span className="font-mono text-muted-foreground">
            bar #{data?.cursor ?? "—"} · {data?.waktu?.slice(0, 10) ?? "—"} ·
            harga{" "}
            <span className="text-foreground font-semibold">
              {data?.harga == null
                ? "—"
                : data.harga.toLocaleString("id-ID", {
                    maximumFractionDigits: data.harga < 10 ? 5 : 2,
                  })}
            </span>
          </span>
          {data && !data.ada_lagi && (
            <span className="text-warning">data habis</span>
          )}
        </div>
      </div>

      {/* Keputusan */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold">Keputusanmu di bar ini</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="block text-muted-foreground mb-1">Stop loss</span>
            <input
              value={sl}
              onChange={(e) => setSl(e.target.value)}
              inputMode="decimal"
              placeholder="di bawah harga"
              className="w-32 px-2 py-1.5 rounded-lg border border-border bg-secondary text-xs font-mono focus:outline-none focus:border-primary/50"
            />
          </label>
          <label className="text-xs">
            <span className="block text-muted-foreground mb-1">
              Take profit
            </span>
            <input
              value={tp}
              onChange={(e) => setTp(e.target.value)}
              inputMode="decimal"
              placeholder="di atas harga"
              className="w-32 px-2 py-1.5 rounded-lg border border-border bg-secondary text-xs font-mono focus:outline-none focus:border-primary/50"
            />
          </label>
          <button
            disabled={!buyValid || sibuk}
            onClick={() => kirim("BUY")}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary/15 text-primary border border-primary/25 disabled:opacity-40"
          >
            Masuk (BUY)
          </button>
          <button
            disabled={sibuk}
            onClick={() => kirim("SKIP")}
            className="px-4 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Lewati
          </button>
          <button
            disabled={sibuk || !data?.ada_lagi}
            onClick={() => setCursor((c) => c + 1)}
            className="px-4 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Bar berikutnya →
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Entry diisi di <strong>open bar berikutnya</strong> — harga yang
          benar-benar bisa didapat, sama seperti backtester. Hasilnya dihitung
          resolver yang sama dengan sinyal live, jadi skor di sini sebanding
          dengan angka sistem.
        </p>
      </div>

      {/* Ringkasan sesi */}
      {ringkas && (
        <div className="rounded-xl border border-border p-4 space-y-2">
          <p className="text-sm font-semibold">Sesi ini</p>
          <div className="flex flex-wrap gap-4 text-xs font-mono">
            <span>{ringkas.diambil} masuk</span>
            <span>{ringkas.dilewati} dilewati</span>
            <span>
              expectancy{" "}
              {ringkas.expectancy_r === null ? "—" : `${ringkas.expectancy_r}R`}
            </span>
            <span>
              winrate {ringkas.win_rate === null ? "—" : `${ringkas.win_rate}%`}
            </span>
          </div>
          {ringkas.catatan && (
            <p className="text-[11px] text-muted-foreground">
              {ringkas.catatan}
            </p>
          )}
        </div>
      )}

      {/* Riwayat keputusan */}
      {hasil.length > 0 && (
        <div className="rounded-xl border border-border divide-y divide-border">
          {hasil.map((h, i) => (
            <div key={`${h.cursor}-${i}`} className="p-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground">
                  bar #{h.cursor} · {h.aksi}
                </span>
                <span
                  className={cn(
                    "font-semibold",
                    OUTCOME_STYLE[h.outcome] ?? "text-foreground",
                  )}
                >
                  {h.outcome}
                  {h.pnl_r !== null && ` · ${h.pnl_r > 0 ? "+" : ""}${h.pnl_r}R`}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{h.catatan}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
