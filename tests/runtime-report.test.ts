// @vitest-environment node
/**
 * `GET /api/runtime`: identitas build + status backend, termasuk perbandingan
 * sidik sumber di disk dengan sidik yang dibakukan saat build.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { backendConfigFromEnv } from "@/lib/server/backend";
import { buildRuntimeReport, resetSourceCache } from "@/lib/server/runtime";
import { buildIdFor, computeBuildIdentity, sourceFingerprint } from "@/lib/build-identity.cjs";
import type { FrontendBuild } from "@/types/runtime";
import { backendRuntime } from "./helpers";

const servers: http.Server[] = [];
afterEach(async () => {
  resetSourceCache();
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
});

async function fakeBackend(routes: Record<string, [number, unknown]>) {
  const server = http.createServer((req, res) => {
    const hit = routes[req.url ?? ""];
    if (!hit) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ detail: "Not Found" }));
      return;
    }
    res.writeHead(hit[0], { "content-type": "application/json" });
    res.end(JSON.stringify(hit[1]));
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function tmpSource(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fe-src-"));
  fs.mkdirSync(path.join(dir, "app"));
  fs.writeFileSync(path.join(dir, "app", "page.tsx"), "export default 1\n");
  fs.writeFileSync(path.join(dir, "package.json"), "{}\n");
  fs.writeFileSync(path.join(dir, ".env.production.local"), "API_WRITE_TOKEN=x\n");
  return dir;
}

function buildFor(dir: string): FrontendBuild {
  const fp = sourceFingerprint(dir);
  return {
    build_id: buildIdFor("abcdef0123", false, fp.hash),
    built_at: "2026-10-04T11:00:00.000Z",
    git_commit: "abcdef0123",
    git_branch: "main",
    git_dirty: false,
    git_dirty_files: 0,
    source_hash: fp.hash,
    source_files: fp.files,
    next_version: "16.2.4",
  };
}

describe("identitas build", () => {
  it("BUILD_ID deterministik terhadap isi sumber dan URL-safe", () => {
    const dir = tmpSource();
    const a = sourceFingerprint(dir);
    expect(sourceFingerprint(dir)).toEqual(a);
    expect(buildIdFor("f2c7c4108d", true, a.hash)).toMatch(/^f2c7c41-d[0-9a-f]{10}$/);
    expect(buildIdFor(null, null, a.hash)).toMatch(/^nogit-u[0-9a-f]{10}$/);
  });

  it("berkas .env tidak ikut sidik (rotasi token tidak mengubah identitas build)", () => {
    const dir = tmpSource();
    const before = sourceFingerprint(dir);
    fs.writeFileSync(path.join(dir, ".env.production.local"), "API_WRITE_TOKEN=y\n");
    expect(sourceFingerprint(dir)).toEqual(before);
    expect(before.files).toBe(2);
  });

  it("computeBuildIdentity tidak memuat nilai .env", () => {
    const dir = tmpSource();
    expect(JSON.stringify(computeBuildIdentity(dir))).not.toContain("API_WRITE_TOKEN");
  });
});

describe("laporan runtime", () => {
  it("backend baru: status ok, identitas backend diteruskan, sumber = build", async () => {
    const upstream = await fakeBackend({ "/system/runtime": [200, backendRuntime()] });
    const dir = tmpSource();
    const report = await buildRuntimeReport(
      backendConfigFromEnv({ TRADING_API_URL: upstream, API_WRITE_TOKEN: "rahasia-xyz" }),
      { root: dir, build: buildFor(dir) },
    );
    expect(report.backend.status).toBe("ok");
    expect(report.backend.runtime?.tier_contract.policy).toBe("weighted-v1");
    expect(report.backend.runtime?.mode).toBe("paper");
    expect(report.frontend.source_matches_build).toBe(true);
    expect(report.proxy.write_token_configured).toBe(true);
    expect(JSON.stringify(report)).not.toContain("rahasia-xyz");
  });

  it("sumber berubah sesudah build → source_matches_build false", async () => {
    const upstream = await fakeBackend({ "/system/runtime": [200, backendRuntime()] });
    const dir = tmpSource();
    const build = buildFor(dir);
    fs.writeFileSync(path.join(dir, "app", "page.tsx"), "export default 2\n");
    const report = await buildRuntimeReport(backendConfigFromEnv({ TRADING_API_URL: upstream }), {
      root: dir,
      build,
    });
    expect(report.frontend.source_matches_build).toBe(false);
    expect(report.frontend.source_hash_now).not.toBe(build.source_hash);
  });

  it("backend lama (tanpa /system/runtime) → legacy, kontrak tetap dari /meta/tiers", async () => {
    const upstream = await fakeBackend({
      "/health": [200, { status: "ok", version: "2.0.0" }],
      "/meta/tiers": [200, { spec_hash: "f553ce3d", policy: "weighted-v1", confidence_calibrated: false, tiers: [] }],
    });
    const report = await buildRuntimeReport(backendConfigFromEnv({ TRADING_API_URL: upstream }), {
      root: tmpSource(),
      build: null,
    });
    expect(report.backend.status).toBe("legacy");
    expect(report.backend.health?.version).toBe("2.0.0");
    expect(report.backend.error).toContain("restart");
    expect(report.backend.runtime).toBeNull();
    expect(report.backend.contract).toEqual({
      policy: "weighted-v1",
      spec_hash: "f553ce3d",
      confidence_calibrated: false,
      source: "meta/tiers",
    });
    expect(report.frontend.source_matches_build).toBeNull();
  });

  it("backend baru: kontrak diambil dari /system/runtime", async () => {
    const upstream = await fakeBackend({ "/system/runtime": [200, backendRuntime()] });
    const report = await buildRuntimeReport(backendConfigFromEnv({ TRADING_API_URL: upstream }), {
      root: tmpSource(),
      build: null,
    });
    expect(report.backend.contract?.source).toBe("system/runtime");
    expect(report.backend.contract?.spec_hash).toBe("f553ce3d");
  });

  it("backend mati → unreachable dengan sebab", async () => {
    const closed = http.createServer();
    await new Promise<void>((r) => closed.listen(0, "127.0.0.1", r));
    const port = (closed.address() as AddressInfo).port;
    await new Promise<void>((r) => closed.close(() => r()));
    const report = await buildRuntimeReport(
      backendConfigFromEnv({ TRADING_API_URL: `http://127.0.0.1:${port}` }),
      { root: tmpSource(), build: null },
    );
    expect(report.backend.status).toBe("unreachable");
    expect(report.backend.error).toMatch(/ECONNREFUSED/);
  });
});
