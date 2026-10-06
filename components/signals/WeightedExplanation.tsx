import type { ScoreDetails, TierSpecsResponse } from "@/types";
import { formatGateLabel } from "@/lib/gates";
import { formatScore } from "@/lib/tiers";

/**
 * Rincian skor kontrak berbobot pada kartu sinyal.
 *
 * Yang wajib terbaca (audit 4 Okt 2026, temuan 2): NAMA kebijakan dan hash
 * kontrak yang benar-benar menghasilkan skor ini, dan bahwa skor adalah
 * jumlah poin konfluensi — bukan probabilitas profit. Nama dan hash diambil
 * dari `score_details` sinyal itu sendiri, bukan dari kontrak yang aktif
 * sekarang: sinyal lama tetap dijelaskan dengan aturannya sendiri.
 */
export default function WeightedExplanation({
  details,
  metadata,
}: {
  details: ScoreDetails;
  metadata?: TierSpecsResponse | null;
}) {
  // Kebijakan berikutnya tidak boleh menafsirkan ulang ambang sinyal tersimpan.
  const sameContract = !metadata || metadata.spec_hash === details.contract_hash;
  const scoring = metadata && sameContract ? metadata.scoring : undefined;
  const thresholds = Object.entries(scoring?.thresholds ?? {});
  const contract = details.contract_hash || "hash tidak tercatat";

  return (
    <div
      className="rounded-lg border border-border bg-secondary/20 p-2.5 space-y-2 text-xs"
      data-testid="weighted-explanation"
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <p className="font-semibold">Skor konfluensi berbobot</p>
        <span
          className="rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
          title="Kebijakan dan hash kontrak tier yang menghitung skor sinyal ini."
        >
          {details.policy} · {contract}
        </span>
      </div>
      <p>
        <span className="font-mono">{formatScore(details.score)}/100</span> poin
        {details.threshold !== null && <> · ambang tier: {details.threshold} poin</>}
      </p>
      {details.tier_reason && <p className="text-muted-foreground">{details.tier_reason}</p>}
      <p className="text-amber-400/90">
        Skor ini jumlah poin faktor teknikal, BUKAN probabilitas profit atau peluang
        menang — skor lebih tinggi belum terbukti memberi hasil lebih baik.
        {details.confidence_calibrated
          ? " Backend menandai confidence kontrak ini terkalibrasi."
          : " Confidence untuk kontrak ini belum dikalibrasi."}
      </p>
      {metadata && !sameContract && (
        <p className="text-muted-foreground">
          Sinyal ini berasal dari kontrak {contract}; kontrak aktif kini{" "}
          <span className="font-mono">{metadata.spec_hash}</span>. Ambang kontrak
          aktif tidak dipakai untuk menafsirkan skor ini.
        </p>
      )}
      {[
        { label: "Faktor positif", factors: details.positive_factors, negative: false },
        { label: "Faktor negatif", factors: details.negative_factors, negative: true },
      ].map(({ label, factors, negative }) => (
        <div key={label}>
          <p className="font-medium">{label}</p>
          {factors.length ? (
            <ul className="mt-1 space-y-1 text-muted-foreground">
              {factors.map(({ factor, points }, index) => (
                <li key={`${factor}-${index}`} className="flex justify-between gap-3">
                  <span>{formatGateLabel(factor)}</span>
                  <span className="font-mono shrink-0">
                    {negative ? "−" : "+"}
                    {formatScore(Math.abs(points))} poin
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Tidak ada faktor tercatat.</p>
          )}
        </div>
      ))}
      <p className={details.veto.length ? "text-amber-400" : "text-muted-foreground"}>
        Veto: {details.veto.length ? details.veto.map(formatGateLabel).join(", ") : "tidak ada"}
      </p>
      {Object.keys(details.groups).length > 0 && (
        <details className="text-muted-foreground">
          <summary className="cursor-pointer">Poin per kelompok</summary>
          <ul className="mt-1 space-y-1">
            {Object.entries(details.groups).map(([group, points]) => (
              <li key={group}>
                {formatGateLabel(group)}: {formatScore(points)}
                {typeof scoring?.groups?.[group] === "number" && ` / ${scoring.groups[group]}`} poin
              </li>
            ))}
          </ul>
        </details>
      )}
      {thresholds.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Ambang {details.policy}: {thresholds.map(([tier, value]) => `${tier} ≥ ${value}`).join(" · ")}
        </p>
      )}
    </div>
  );
}
