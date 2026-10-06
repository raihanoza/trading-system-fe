#!/usr/bin/env node
/**
 * Sajikan build verifikasi (`.next-verify`) di port terpisah (bawaan 4019)
 * untuk memeriksa tampilan sebelum aktivasi. Service produksi :4011 dan
 * folder `.next`-nya tidak disentuh.
 *
 *   node scripts/start-verify.mjs [port] [distDir]
 */
import { spawn } from "node:child_process";
import path from "node:path";

const port = process.argv[2] ?? process.env.PORT ?? "4019";
const distDir = process.argv[3] ?? ".next-verify";
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "start", "-p", port, "-H", "127.0.0.1"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_DIST_DIR: distDir, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill());
