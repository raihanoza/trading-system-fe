// @vitest-environment node
/**
 * Kontrak UI–API melawan backend ASLI (FastAPI + Pydantic + SQLite), bukan
 * tiruan: klien `lib/api.ts` → proxy `lib/server/backend.ts` → uvicorn.
 *
 * Backend dijalankan dari repo tetangga (`../trading-system`, atau
 * TRADING_BACKEND_DIR) dengan DB, cache, dan log di folder sementara — cwd
 * proses juga folder sementara, jadi `.env` dan log service live tidak
 * tersentuh. Bila backend/venv tidak ada (mis. CI frontend saja), tes dilewati.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, configureApi, resetApiConfig } from "@/lib/api";
import { ApiError, isApiError } from "@/lib/api-error";
import { backendConfigFromEnv, proxyToBackend, type BackendConfig } from "@/lib/server/backend";
import { buildRuntimeReport } from "@/lib/server/runtime";

const BACKEND = path.resolve(
  process.env.TRADING_BACKEND_DIR ?? fileURLToPath(new URL("../../../trading-system", import.meta.url)),
);
const PYTHON = [
  path.join(BACKEND, ".venv", "Scripts", "python.exe"),
  path.join(BACKEND, ".venv", "bin", "python"),
].find((p) => fs.existsSync(p));
const available = Boolean(PYTHON && fs.existsSync(path.join(BACKEND, "api", "main.py")));

const TOKEN = crypto.randomBytes(16).toString("hex");
let child: ChildProcess | null = null;
let workdir = "";
let upstream = "";
let logs = "";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
  });
}

async function waitHealthy(url: string, ms: number) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (child?.exitCode != null) throw new Error(`uvicorn berhenti (exit ${child.exitCode}):\n${logs}`);
    try {
      const r = await fetch(`${url}/health`);
      if (r.ok) return;
    } catch {
      /* belum siap */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`backend tidak sehat dalam ${ms} ms:\n${logs}`);
}

/** Klien → proxy (in-process) → backend asli, persis jalur produksi minus Next. */
function wire(cfg: BackendConfig) {
  configureApi({
    baseUrl: "http://127.0.0.1:4011/api/backend",
    fetch: (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input));
      const headers = new Headers(init.headers);
      headers.set("host", "127.0.0.1:4011");
      headers.set("origin", "http://127.0.0.1:4011");
      const req = new Request(url, { ...init, headers });
      const segments = url.pathname.replace(/^\/api\/backend\//, "").split("/");
      return proxyToBackend(req, segments, cfg);
    }) as typeof fetch,
  });
}

async function apiError(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    if (isApiError(e)) return e;
    throw e;
  }
  throw new Error("permintaan tidak gagal");
}

describe.skipIf(!available)("kontrak UI–API melawan backend asli", () => {
  beforeAll(async () => {
    workdir = fs.mkdtempSync(path.join(os.tmpdir(), "fe-contract-"));
    const port = await freePort();
    upstream = `http://127.0.0.1:${port}`;
    child = spawn(
      PYTHON!,
      ["-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", String(port)],
      {
        cwd: workdir,
        env: {
          ...process.env,
          PYTHONPATH: BACKEND,
          DATABASE_PATH: path.join(workdir, "trading.db"),
          CACHE_DIR: path.join(workdir, "cache"),
          PAPER_TRADE: "1",
          API_CORS_ORIGINS: "http://127.0.0.1:4011",
          API_WRITE_TOKEN: TOKEN,
          PYTHONIOENCODING: "utf-8",
        },
        windowsHide: true,
      },
    );
    child.stdout?.on("data", (d) => (logs += d));
    child.stderr?.on("data", (d) => (logs += d));
    await waitHealthy(upstream, 90_000);

    // Satu trade terbuka untuk jalur tutup → 409. Skema dibuat oleh migrasi
    // startup backend sendiri; tes hanya menyisipkan baris.
    const seed = spawnSync(
      PYTHON!,
      [
        "-c",
        "import sqlite3,sys; db=sqlite3.connect(sys.argv[1]); " +
          "db.execute(\"INSERT INTO trades (ticker,market,tier,entry,stop_loss,take_profit,units,risk_idr,outcome,opened_at) " +
          "VALUES ('BBCA.JK','stock_idx','RADAR',100,95,110,1,5,'open','2026-10-04T00:00:00+00:00')\"); db.commit()",
        path.join(workdir, "trading.db"),
      ],
      { encoding: "utf8" },
    );
    expect(seed.status, seed.stderr).toBe(0);
  });

  afterAll(() => {
    resetApiConfig();
    child?.kill();
  });

  it("identitas runtime: paper, weighted-v1, token wajib — tanpa membocorkan token", async () => {
    wire(backendConfigFromEnv({ TRADING_API_URL: upstream, API_WRITE_TOKEN: TOKEN }));
    const rt = await api.system.runtime();
    expect(rt.mode).toBe("paper");
    expect(rt.tier_contract.policy).toBe("weighted-v1");
    expect(rt.tier_contract.score_is_probability).toBe(false);
    expect(rt.config.write_auth_required).toBe(true);
    expect(rt.evaluation_floor.min_terminal).toBeGreaterThan(0);
    expect(JSON.stringify(rt)).not.toContain(TOKEN);

    const report = await buildRuntimeReport(
      backendConfigFromEnv({ TRADING_API_URL: upstream, API_WRITE_TOKEN: TOKEN }),
      { build: null },
    );
    expect(report.backend.status).toBe("ok");
    expect(report.backend.contract).toEqual({
      policy: "weighted-v1",
      spec_hash: rt.tier_contract.spec_hash,
      confidence_calibrated: rt.tier_contract.confidence_calibrated,
      source: "system/runtime",
    });
    // Kontrak /system/runtime harus sama dengan /meta/tiers (satu sumber).
    const meta = await api.meta.tiers();
    expect(meta.spec_hash).toBe(rt.tier_contract.spec_hash);
    expect(report.proxy.write_token_configured).toBe(true);
    expect(JSON.stringify(report)).not.toContain(TOKEN);
  });

  it("data kosong: daftar sinyal [] dan report card tanpa sampel, bukan galat", async () => {
    wire(backendConfigFromEnv({ TRADING_API_URL: upstream, API_WRITE_TOKEN: TOKEN }));
    expect(await api.signals.all(5)).toEqual([]);
    const card = await api.analytics.reportCard("all", "active");
    expect(card.overall.decided).toBe(0);
    expect(card.contract?.active).toBe(card.contract?.selected);
  });

  it("paper: token sah tetap ditolak 403 → paper_mode", async () => {
    wire(backendConfigFromEnv({ TRADING_API_URL: upstream, API_WRITE_TOKEN: TOKEN }));
    expect((await apiError(api.trades.execute(1, 1))).kind).toBe("paper_mode");
  });

  it("tanpa token di server frontend: mutasi 401 → unauthorized", async () => {
    wire(backendConfigFromEnv({ TRADING_API_URL: upstream }));
    const e = await apiError(api.trades.close(1, 110));
    expect(e.status).toBe(401);
    expect(e.kind).toBe("unauthorized");
  });

  it("422 untuk harga tidak sah; close pertama sukses; close kedua 409", async () => {
    wire(backendConfigFromEnv({ TRADING_API_URL: upstream, API_WRITE_TOKEN: TOKEN }));
    const invalid = await apiError(api.trades.close(1, -1));
    expect(invalid.kind).toBe("validation");
    expect(invalid.issues.map((i) => i.field)).toContain("exit_price");

    const ok = await api.trades.close(1, 110, "uji kontrak");
    expect(ok.outcome).toBe("win");

    const again = await apiError(api.trades.close(1, 120));
    expect(again.kind).toBe("conflict");
    expect(again.status).toBe(409);

    const trades = await api.trades.list();
    expect(trades).toHaveLength(1);
    expect(trades[0].exit_price).toBe(110);
  });

  it("backend mati: backend_unreachable, bukan data kosong", async () => {
    const port = await freePort();
    wire(backendConfigFromEnv({ TRADING_API_URL: `http://127.0.0.1:${port}` }));
    expect((await apiError(api.stats())).kind).toBe("backend_unreachable");
  });
});
