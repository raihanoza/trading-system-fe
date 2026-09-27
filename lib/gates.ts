/**
 * Label & deskripsi gate — satu sumber untuk SignalCard dan ShadowSignals.
 *
 * Dulu tinggal di dalam SignalCard. Diangkat ke sini 25 Agustus 2026 saat
 * baris shadow (E1) mulai ditampilkan: keduanya menamai gate yang sama, dan
 * dua salinan berarti cepat atau lambat namanya berbeda di dua layar.
 */

export const GATE_LABELS: Record<
  string,
  { label: string; description: string }
> = {
  htf_trend_aligned: {
    label: "HTF Trend",
    description: "Trend di higher timeframe sejalan dengan signal",
  },
  mtf_confirmed: {
    label: "HTF Trend (alias MTF)",
    description:
      "Alias historis dari HTF Trend pada crypto/forex; bukan bukti kedua",
  },
  bos_or_choch: {
    label: "BOS/CHoCH",
    description: "Ada Break of Structure atau Change of Character",
  },
  price_in_poi: {
    label: "Price in POI",
    description: "Harga sudah masuk Point of Interest (S/R zone)",
  },
  volume_spike: {
    label: "Volume Spike",
    description: "Volume signifikan di atas rata-rata",
  },
  volume_absorption: {
    label: "Volume Absorb",
    description: "Tekanan jual/beli diserap",
  },
  liquidity_sweep_done: {
    label: "Liquidity Sweep",
    description: "Stop loss retail sudah ter-sweep",
  },
  fvg_present: {
    label: "FVG Present",
    description: "Fair Value Gap teridentifikasi",
  },
  htf_candle_close: {
    label: "HTF Close",
    description: "Konfirmasi penutupan candle di HTF",
  },
  triple_confluence: {
    label: "Triple Confluence",
    description: "3+ faktor saling mendukung",
  },
  no_high_impact_news: {
    label: "No News Risk",
    description: "Tidak ada news high-impact dalam danger zone",
  },
  kill_zone: {
    label: "Kill Zone",
    description: "Sesi London/NY aktif (untuk forex)",
  },
  pdh_pdl_taken: {
    label: "PDH/PDL Taken",
    description: "Previous Day High/Low sudah disentuh",
  },
};

export const formatGateLabel = (g: string): string =>
  GATE_LABELS[g]?.label ??
  g.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const getGateDescription = (g: string): string =>
  GATE_LABELS[g]?.description ?? "Gate teknikal";
