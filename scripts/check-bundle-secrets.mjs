#!/usr/bin/env node
/**
 * Pastikan tidak ada secret di hasil build, di Git, atau di localStorage.
 *
 *   node scripts/check-bundle-secrets.mjs [distDir]      (bawaan: .next)
 *
 * Yang diperiksa:
 *   1. NILAI setiap variabel bernama *TOKEN/*SECRET/*KEY/*PASSWORD di berkas
 *      .env* frontend dan .env backend (TRADING_BACKEND_DIR atau
 *      ../trading-system) tidak muncul di mana pun dalam distDir (kecuali cache).
 *   2. Pola kredensial umum tidak muncul di bundle browser (distDir/static).
 *   3. Tidak ada variabel NEXT_PUBLIC_* bernama rahasia (akan masuk bundle).
 *   4. Tidak ada berkas .env* selain .env.example yang terlacak Git.
 *   5. Sumber tidak menyimpan token/kunci ke localStorage/sessionStorage.
 *
 * Nilai rahasia tidak pernah dicetak — hanya nama variabel dan berkasnya.
 * Keluar dengan kode 1 bila ada temuan.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const distDir = path.resolve(root, process.argv[2] ?? ".next");
const backendDir = path.resolve(process.env.TRADING_BACKEND_DIR ?? path.join(root, "..", "trading-system"));
const SECRET_NAME = /(TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|_KEY)$/i;

const findings = [];
const note = (kind, detail) => findings.push({ kind, detail });

function parseEnv(file) {
  const out = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out.push({ name: m[1], value });
  }
  return out;
}

function envFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(".env") && f !== ".env.example")
    .map((f) => path.join(dir, f));
}

function walk(dir, skip = () => false) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (skip(abs, entry)) continue;
    if (entry.isDirectory()) files.push(...walk(abs, skip));
    else if (entry.isFile()) files.push(abs);
  }
  return files;
}

// ── 1 & 3: nilai rahasia dari berkas env ────────────────────────────────────
const secrets = [];
for (const file of [...envFiles(root), ...envFiles(backendDir)]) {
  for (const { name, value } of parseEnv(file)) {
    if (name.startsWith("NEXT_PUBLIC_") && SECRET_NAME.test(name)) {
      note("public-secret-name", `${name} di ${path.relative(root, file)} akan masuk bundle browser`);
    }
    if (SECRET_NAME.test(name) && value.length >= 8) {
      secrets.push({ name, file: path.relative(root, file), value });
    }
  }
}

if (!fs.existsSync(distDir)) {
  console.error(`distDir tidak ada: ${distDir} — jalankan build dulu.`);
  process.exit(2);
}

const distFiles = walk(distDir, (abs, entry) => entry.isDirectory() && entry.name === "cache");
const textExt = /\.(js|mjs|cjs|json|html|rsc|txt|css|map|nft\.json)$/i;
let scanned = 0;
const staticDir = path.join(distDir, "static");
const PATTERNS = [
  ["bearer-literal", /Bearer\s+[A-Za-z0-9._~+/-]{20,}/],
  ["private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["aws-key", /AKIA[0-9A-Z]{16}/],
  ["github-token", /gh[pousr]_[A-Za-z0-9]{30,}/],
  ["openai-like", /\bsk-[A-Za-z0-9]{24,}/],
  ["slack-token", /xox[baprs]-[A-Za-z0-9-]{10,}/],
];

for (const file of distFiles) {
  if (!textExt.test(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  scanned++;
  for (const s of secrets) {
    if (text.includes(s.value)) {
      note("secret-value-in-build", `nilai ${s.name} (${s.file}) muncul di ${path.relative(root, file)}`);
    }
  }
  if (file.startsWith(staticDir)) {
    for (const [kind, re] of PATTERNS) {
      if (re.test(text)) note(kind, `pola ${kind} di ${path.relative(root, file)}`);
    }
  }
}

// ── 4: berkas env terlacak Git ──────────────────────────────────────────────
try {
  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split(/\r?\n/)
    .filter((f) => /(^|\/)\.env/.test(f) && !f.endsWith(".env.example"));
  for (const f of tracked) note("env-tracked-in-git", f);
} catch {
  note("git-unavailable", "git ls-files gagal — pemeriksaan Git dilewati");
}

// ── 5: penyimpanan browser untuk token ──────────────────────────────────────
const srcFiles = ["app", "components", "hooks", "lib"].flatMap((d) =>
  walk(path.join(root, d)).filter((f) => /\.(t|j)sx?$|\.cjs$|\.mjs$/.test(f)),
);
for (const file of srcFiles) {
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(/(localStorage|sessionStorage)\.setItem\(([^)]*)\)/g)) {
    if (/token|secret|password|api.?key|authorization/i.test(m[2])) {
      note("token-in-browser-storage", `${path.relative(root, file)}: ${m[0].slice(0, 80)}`);
    }
  }
}

const hard = findings.filter((f) => f.kind !== "git-unavailable");
const summary = {
  distDir: path.relative(root, distDir) || ".",
  files_scanned: scanned,
  secret_values_checked: secrets.map((s) => `${s.name}@${s.file}`),
  findings,
  ok: hard.length === 0,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(hard.length === 0 ? 0 : 1);
