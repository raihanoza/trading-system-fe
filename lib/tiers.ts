import type { TierMeta } from "@/types";

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
