#!/usr/bin/env node
/**
 * Build produksi ke folder TERPISAH (bawaan `.next-verify`) supaya bisa
 * diperiksa tanpa menyentuh `.next` yang sedang disajikan service
 * `next start`. Build ID-nya deterministik terhadap isi sumber
 * (lib/build-identity.cjs), jadi build final ke `.next` dari sumber yang sama
 * mendapat ID yang sama.
 *
 * Next menambahkan `<distDir>/types/**` ke `tsconfig.json` dan menulis ulang
 * `next-env.d.ts` untuk distDir lain. Keduanya dipulihkan setelah build:
 * `tsconfig.json` termasuk sidik sumber, dan perubahan otomatis itu akan
 * membuat build final tampak berasal dari sumber yang berbeda.
 *
 *   node scripts/build-verify.mjs [distDir]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const distDir = process.argv[2] ?? ".next-verify";
if (distDir === ".next") {
  console.error("Gunakan `npm run build` untuk .next — skrip ini khusus build verifikasi.");
  process.exit(2);
}

const restore = ["tsconfig.json", "next-env.d.ts"]
  .filter((f) => fs.existsSync(f))
  .map((f) => [f, fs.readFileSync(f)]);

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
let res;
try {
  res = spawnSync(process.execPath, [nextBin, "build"], {
    stdio: "inherit",
    env: { ...process.env, NEXT_DIST_DIR: distDir, NEXT_TELEMETRY_DISABLED: "1" },
  });
} finally {
  for (const [file, content] of restore) {
    if (!fs.readFileSync(file).equals(content)) {
      fs.writeFileSync(file, content);
      console.log(`dipulihkan: ${file} (diubah otomatis oleh next build untuk ${distDir})`);
    }
  }
}
if (res.status !== 0) process.exit(res.status ?? 1);
const id = fs.readFileSync(path.join(distDir, "BUILD_ID"), "utf8").trim();
console.log(`\nBuild verifikasi selesai: ${distDir}/BUILD_ID = ${id}`);
