import type { ScoreDetails, TierSpecsResponse } from "@/types";
import { formatGateLabel } from "@/lib/gates";

export default function WeightedExplanation({
  details,
  metadata,
}: {
  details: ScoreDetails;
  metadata?: TierSpecsResponse | null;
}) {
  // A later policy must never reinterpret the thresholds of a saved signal.
  const scoring = metadata?.spec_hash === details.contract_hash ? metadata.scoring : undefined;
  const thresholds = Object.entries(scoring?.thresholds ?? {});
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-2.5 space-y-2 text-xs">
      <p className="font-semibold">Penjelasan skor berbobot</p>
      <p>
        <span className="font-mono">{details.score}/100</span> poin
        {details.threshold !== null && <> · Ambang tier: {details.threshold} poin</>}
      </p>
      {details.tier_reason && <p className="text-muted-foreground">{details.tier_reason}</p>}
      <p className="text-amber-400/90">
        Skor bukan peluang menang; belum dikalibrasi untuk kontrak ini.
      </p>
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
                  <span className="font-mono shrink-0">{negative ? "−" : "+"}{Math.abs(points)} poin</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-muted-foreground">Tidak ada faktor tercatat.</p>}
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
                {formatGateLabel(group)}: {points}
                {typeof scoring?.groups?.[group] === "number" && ` / ${scoring.groups[group]}`} poin
              </li>
            ))}
          </ul>
        </details>
      )}
      {thresholds.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Ambang kebijakan: {thresholds.map(([tier, value]) => `${tier} ≥ ${value}`).join(" · ")}
        </p>
      )}
    </div>
  );
}
