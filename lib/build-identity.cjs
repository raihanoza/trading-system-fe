/**
 * Identitas build frontend yang bisa diverifikasi.
 *
 * Dipakai dua tempat dengan fungsi yang SAMA, supaya hasilnya sebanding:
 *   - next.config.ts saat `next build` → dibakukan ke bundle + BUILD_ID;
 *   - app/api/runtime/route.ts saat runtime → sidik sumber di disk sekarang.
 * Bila keduanya berbeda, build yang disajikan bukan hasil sumber yang ada.
 *
 * CommonJS karena next.config.ts di Node 20 hanya bisa me-require CommonJS.
 * Modul ini tidak pernah membaca berkas `.env*`.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

/** Folder yang ikut membentuk bundle. `tests/`, `docs/`, `scripts/` tidak. */
const SOURCE_DIRS = ["app", "components", "hooks", "lib", "types", "public"];
/** Berkas akar yang memengaruhi hasil build. */
const SOURCE_FILES = [
  "components.json",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "postcss.config.mjs",
  "tailwind.config.ts",
  "tsconfig.json",
];
const SKIP_NAMES = new Set(["node_modules", ".DS_Store", "Thumbs.db", "desktop.ini"]);

/**
 * @param {string} root
 * @returns {string[]} path relatif bergaya POSIX, terurut
 */
function sourceFiles(root) {
  /** @type {string[]} */
  const found = [];
  /** @param {string} rel */
  const walk = (rel) => {
    const abs = path.join(/*turbopackIgnore: true*/ root, rel);
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (SKIP_NAMES.has(entry.name) || entry.name.startsWith(".env")) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(childRel);
      else if (entry.isFile() && !entry.name.endsWith(".tsbuildinfo")) found.push(childRel);
    }
  };
  for (const dir of SOURCE_DIRS) {
    if (fs.existsSync(path.join(/*turbopackIgnore: true*/ root, dir))) walk(dir);
  }
  for (const file of SOURCE_FILES) {
    if (fs.existsSync(path.join(/*turbopackIgnore: true*/ root, file))) found.push(file);
  }
  return found.sort();
}

/**
 * SHA-256 atas (path, isi) setiap berkas sumber.
 * @param {string} root
 * @returns {{ hash: string, files: number }}
 */
function sourceFingerprint(root) {
  const digest = crypto.createHash("sha256");
  const files = sourceFiles(root);
  for (const rel of files) {
    const content = fs.readFileSync(path.join(/*turbopackIgnore: true*/ root, rel));
    digest.update(`${rel}\0`);
    digest.update(crypto.createHash("sha256").update(content).digest());
  }
  return { hash: digest.digest("hex").slice(0, 16), files: files.length };
}

/**
 * @param {string} root
 * @param {string[]} args
 * @returns {string | null}
 */
function git(root, args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 20000,
      windowsHide: true,
    }).trim();
  } catch {
    return null;
  }
}

/**
 * @param {string} root
 * @param {{ now?: Date }} [opts]
 */
function computeBuildIdentity(root, opts = {}) {
  const fp = sourceFingerprint(root);
  const commit = git(root, ["rev-parse", "HEAD"]);
  const branch = commit ? git(root, ["rev-parse", "--abbrev-ref", "HEAD"]) : null;
  const status = commit
    ? git(root, ["status", "--porcelain", "--untracked-files=all", "--", ...SOURCE_DIRS, ...SOURCE_FILES])
    : null;
  const dirtyFiles = status === null ? null : status.split(/\r?\n/).filter(Boolean).length;
  const dirty = dirtyFiles === null ? null : dirtyFiles > 0;
  let nextVersion = "unknown";
  try {
    nextVersion = JSON.parse(
      fs.readFileSync(path.join(/*turbopackIgnore: true*/ root, "node_modules", "next", "package.json"), "utf8"),
    ).version;
  } catch {
    /* tanpa node_modules: biarkan "unknown" */
  }
  return {
    build_id: buildIdFor(commit, dirty, fp.hash),
    built_at: (opts.now ?? new Date()).toISOString(),
    git_commit: commit,
    git_branch: branch,
    git_dirty: dirty,
    git_dirty_files: dirtyFiles,
    source_hash: fp.hash,
    source_files: fp.files,
    next_version: nextVersion,
  };
}

/**
 * Deterministik terhadap isi sumber: dua build dari keadaan yang sama
 * mendapat ID yang sama. `c` = working tree bersih, `d` = ada perubahan
 * belum di-commit (ID-nya tetap unik karena memuat hash isi).
 * @param {string | null} commit
 * @param {boolean | null} dirty
 * @param {string} sourceHash
 */
function buildIdFor(commit, dirty, sourceHash) {
  const head = commit ? commit.slice(0, 7) : "nogit";
  const state = dirty === null ? "u" : dirty ? "d" : "c";
  return `${head}-${state}${sourceHash.slice(0, 10)}`;
}

module.exports = {
  SOURCE_DIRS,
  SOURCE_FILES,
  sourceFiles,
  sourceFingerprint,
  computeBuildIdentity,
  buildIdFor,
};
