import type { ScoreDetails, Signal, TierMeta } from "@/types";

/** Empty historical details keep the legacy explanation; zero is a valid score. */
export function weightedScoreDetails(
  details: Signal["score_details"],
): ScoreDetails | null {
  if (!details || details.policy !== "weighted-v1" ||
      typeof details.score !== "number" || !Number.isFinite(details.score) ||
      details.score < 0 || details.score > 100) return null;
  return {
    policy: details.policy,
    contract_hash: details.contract_hash ?? "",
    score: details.score,
    threshold: typeof details.threshold === "number" && Number.isFinite(details.threshold)
      ? details.threshold : null,
    positive_factors: details.positive_factors ?? [],
    negative_factors: details.negative_factors ?? [],
    veto: details.veto ?? [],
    tier_reason: details.tier_reason ?? "",
    groups: details.groups ?? {},
    confidence_calibrated: details.confidence_calibrated === true,
  };
}

/**
 * Kebijakan skor yang TIDAK dikenali UI ini (mis. kontrak baru setelah
 * weighted-v1). Mengembalikan namanya supaya kartu bisa berkata "belum
 * dikenali" alih-alih diam-diam menjelaskannya dengan aturan AND lama.
 */
export function unknownScorePolicy(details: Signal["score_details"]): string | null {
  if (!details || typeof details.policy !== "string" || !details.policy) return null;
  return details.policy === "weighted-v1" ? null : details.policy;
}

/** 66.7333 → "66,7"; bilangan bulat tanpa desimal. Skor ditampilkan, bukan dihitung ulang. */
export function formatScore(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("id-ID", { maximumFractionDigits: 1 });
}

export interface TierLadder {
  currentTier: string;
  nextTier: string | null; // null = sudah tier tertinggi
  missingMandatory: string[]; // gate mandatory tier atas yang belum true
  rrNeeded: number | null; // min_rr tier atas kalau R:R kurang, else null
  optionalShort: number; // berapa gate optional lagi yang kurang
  totalGap: number; // total kekurangan (mandatory + optional + rr)
  nearly: boolean; // totalGap === 1 → "nyaris"
}

/**
 * Hitung "kurang berapa untuk naik ke tier di atas".
 * `tiers` diurutkan tertinggi→terendah (SNIPER..RADAR), sesuai /meta/tiers.
 * Fungsi murni — mudah dinalar & (kalau perlu) dites.
 */
export function computeTierLadder(
  achievedTier: string,
  knownTrue: string[],
  rrRatio: number,
  tiers: TierMeta[],
): TierLadder | null {
  const idx = tiers.findIndex((t) => t.tier === achievedTier);
  if (idx < 0) return null;

  // Tier tertinggi (indeks 0) — tak ada yang di atas.
  if (idx === 0) {
    return {
      currentTier: achievedTier,
      nextTier: null,
      missingMandatory: [],
      rrNeeded: null,
      optionalShort: 0,
      totalGap: 0,
      nearly: false,
    };
  }

  const next = tiers[idx - 1]; // satu tingkat di atas
  const known = new Set(knownTrue);
  const missingMandatory = next.mandatory.filter((g) => !known.has(g));
  const rrNeeded = rrRatio < next.min_rr ? next.min_rr : null;
  const optHave = next.optional.filter((g) => known.has(g)).length;
  const optionalShort = Math.max(0, next.min_opt - optHave);
  const totalGap =
    missingMandatory.length + optionalShort + (rrNeeded !== null ? 1 : 0);

  return {
    currentTier: achievedTier,
    nextTier: next.tier,
    missingMandatory,
    rrNeeded,
    optionalShort,
    totalGap,
    nearly: totalGap === 1,
  };
}

export function tierSpec(
  tier: string,
  tiers: TierMeta[],
): TierMeta | undefined {
  return tiers.find((t) => t.tier === tier);
}
