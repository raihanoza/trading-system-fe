import type { NextConfig } from "next";
import { PHASE_PRODUCTION_SERVER } from "next/constants";
import { computeBuildIdentity } from "./lib/build-identity.cjs";

/**
 * Identitas build dihitung SEKALI saat build (dan dev), lalu dibakukan ke
 * bundle lewat `env` serta dipakai sebagai BUILD_ID. Saat `next start`
 * (PHASE_PRODUCTION_SERVER) tidak dihitung ulang: nilai yang dilayani harus
 * nilai saat build, bukan keadaan disk saat service dinyalakan.
 *
 * `NEXT_DIST_DIR` memungkinkan build verifikasi ke folder lain (mis.
 * `.next-verify`) tanpa menyentuh `.next` yang sedang disajikan `next start`.
 */
export default function config(phase: string): NextConfig {
  const distDir = process.env.NEXT_DIST_DIR || ".next";
  if (phase === PHASE_PRODUCTION_SERVER) return { distDir };

  const identity = computeBuildIdentity(process.cwd());
  return {
    distDir,
    generateBuildId: async () => identity.build_id,
    env: {
      TS_FE_BUILD_IDENTITY: JSON.stringify(identity),
    },
  };
}
