import type { BackendRuntime } from "@/types/runtime";

/**
 * "Cara membaca angka di layar ini" — satu sumber penjelasan untuk istilah
 * yang paling sering disalahbaca (audit 4 Okt 2026, temuan 2, 7, dan 9).
 *
 * Angka kebijakan (nama kontrak, kalibrasi, lantai vonis) dibaca dari
 * `/system/runtime` backend, bukan disalin ke sini. Bila backend belum
 * menyediakannya, teks menyatakannya alih-alih menebak.
 */
export interface GlossaryTerm {
  id: string;
  term: string;
  body: string;
}

type Contract = { policy: string | null; spec_hash: string; confidence_calibrated: boolean };

export function glossaryTerms(
  runtime: BackendRuntime | null,
  fallbackContract: Contract | null = null,
): GlossaryTerm[] {
  // Backend lama belum punya /system/runtime, tetapi kontraknya tetap
  // diketahui dari /meta/tiers.
  const contract: Contract | null = runtime?.tier_contract ?? fallbackContract;
  const policy = contract?.policy ?? "kebijakan tier aktif";
  const hash = contract?.spec_hash ? ` (kontrak ${contract.spec_hash})` : "";
  const calibrated = contract?.confidence_calibrated;
  const floor = runtime?.evaluation_floor;
  const mode = runtime?.mode;

  return [
    {
      id: "skor",
      term: `Skor ${policy} (0–100)`,
      body:
        `Jumlah poin faktor teknikal — tren, struktur, area entry, momentum, ` +
        `partisipasi, volatilitas, dan R:R — dengan batas per kelompok dan ` +
        `penalti, menurut ${policy}${hash}. Skor BUKAN probabilitas profit atau ` +
        `peluang menang: skor 70 tidak berarti 70% menang, dan skor lebih tinggi ` +
        `belum terbukti memberi hasil lebih baik.`,
    },
    {
      id: "tier",
      term: "Tier (RADAR … SNIPER)",
      body:
        "Label ambang skor — hitungan konfluensi, bukan tingkat kualitas. Audit " +
        "25 Sep 2026 menemukan tier tidak memisahkan hasil; risiko per sinyal " +
        "sama untuk semua tier BUY.",
    },
    {
      id: "confidence",
      term: "Confidence",
      body:
        calibrated === false
          ? `Belum dikalibrasi untuk kontrak ini${hash}. Nilainya nyaris konstan ` +
            "per pasar; jangan dipakai mengurutkan atau membandingkan sinyal."
          : calibrated === true
            ? "Backend menyatakan confidence terkalibrasi untuk kontrak ini; tetap " +
              "bandingkan dengan kurva reliability sebelum dipakai."
            : "Status kalibrasi tidak diketahui (backend belum menjawab). Perlakukan " +
              "sebagai belum terkalibrasi.",
    },
    {
      id: "winrate",
      term: "Win rate",
      body:
        "Proporsi sinyal teresolusi yang menyentuh TP sebelum SL menurut resolver. " +
        "Resolver mengasumsikan entry terisi dan keluar tepat di level SL walau " +
        "harga melompat (gap) — ini ukuran sinyal, bukan hasil order nyata. Win " +
        "rate tanpa besar menang/kalah tidak menunjukkan profit: kandidat CM1 " +
        "ber-win rate ±60% tetap rugi per trade.",
    },
    {
      id: "expectancy",
      term: "Expectancy (R)",
      body:
        "Rata-rata hasil per sinyal dalam kelipatan risiko rencana (1R = jarak " +
        "entry ke stop) setelah biaya model. Bukan persentase saldo.",
    },
    {
      id: "ci",
      term: "Interval kepercayaan (CI)",
      body:
        "Rentang ketidakpastian 95%. Untuk win rate di report card dipakai " +
        "interval Wilson yang menganggap setiap sinyal independen; sinyal pada " +
        "hari yang sama saling berkorelasi, jadi ketidakpastian sebenarnya lebih " +
        "lebar. Vonis forward memakai CI expectancy berkelompok per blok hari. " +
        "CI yang memuat 0R berarti edge belum terbukti, berapa pun titik " +
        "tengahnya. Label \"indikatif\" (n < 30) hanya tanda tampilan, bukan lantai keputusan.",
    },
    {
      id: "forward",
      term: "Data forward & batas evaluasi",
      body: floor
        ? `Forward = sinyal kontrak aktif yang terbit sesudah burn-in, dinilai ` +
          `resolver ke depan. Vonis per pasar baru sah bila ≥${floor.min_terminal} ` +
          `sinyal terminal, ≥${floor.min_days} hari penerbitan dengan hasil ` +
          `terminal, ≥${floor.min_blocks} blok (blok: ` +
          Object.entries(floor.block_days)
            .map(([m, d]) => `${m} ${d} hari`)
            .join(", ") +
          `), dan setengah lebar CI expectancy ≤${floor.max_ci_half_width_r}R. ` +
          `Di bawah lantai itu jawabannya "belum dapat dipastikan" — halaman UI ` +
          `tidak mengeluarkan vonis.`
        : "Lantai vonis forward belum bisa dibaca dari backend (endpoint " +
          "/system/runtime belum tersedia). Halaman UI tidak mengeluarkan vonis.",
    },
    {
      id: "paper",
      term: "Paper trading",
      body:
        mode === "paper"
          ? "Backend berjalan dalam mode PAPER: tidak ada order uang nyata, " +
            "pencatatan eksekusi live ditolak (403), dan sinyal diukur otomatis. " +
            "Jurnal trade manual terpisah dari data forward."
          : mode === "live"
            ? "Backend berjalan dalam mode LIVE: pencatatan eksekusi diizinkan " +
              "konfigurasi. Itu bukan bukti edge — periksa vonis forward."
            : "Mode paper/live belum diketahui (backend belum menjawab).",
    },
    {
      id: "ml",
      term: "Feature importance & ML",
      body:
        "Halaman ML bersifat eksperimental. Importance Random Forest mengukur " +
        "seberapa banyak model bergantung pada sebuah gate, tanpa tanda: gate " +
        "yang bagus memprediksi KERUGIAN juga mendapat importance tinggi. Bobot " +
        "turunannya tidak dipakai scanner dan bukan dasar mengubah tier atau sizing.",
    },
  ];
}

export default function MetricGlossary({
  runtime,
  contract = null,
  only,
  className,
}: {
  runtime: BackendRuntime | null;
  /** Kontrak dari `/meta/tiers` bila `runtime` belum tersedia. */
  contract?: Contract | null;
  /** Subset istilah, urut sesuai daftar. */
  only?: string[];
  className?: string;
}) {
  const terms = glossaryTerms(runtime, contract).filter((t) => !only || only.includes(t.id));
  return (
    <div className={className}>
      <dl className="space-y-2.5">
        {terms.map((t) => (
          <div key={t.id} data-term={t.id}>
            <dt className="text-xs font-semibold text-foreground">{t.term}</dt>
            <dd className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t.body}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
