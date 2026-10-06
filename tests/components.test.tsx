/**
 * Tes komponen: makna skor, identitas runtime, mode paper, dan penanganan
 * 401/403/409/422/jaringan di dialog yang benar-benar dipakai pengguna.
 * `fetch` global diganti router palsu — komponen memanggil jalur yang sama
 * dengan di produksi (`/api/runtime`, `/api/backend/...`).
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScoreDetails, Signal, Trade } from "@/types";
import type { RuntimeReport } from "@/types/runtime";
import { ApiError } from "@/lib/api-error";
import { __setRuntimeStateForTests } from "@/lib/runtime";
import WeightedExplanation from "@/components/signals/WeightedExplanation";
import MetricGlossary from "@/components/system/MetricGlossary";
import RuntimeIdentityPanel from "@/components/system/RuntimeIdentityPanel";
import RuntimeStatusChip from "@/components/system/RuntimeStatusChip";
import { ApiErrorNotice, EmptyState } from "@/components/system/StateNotice";
import RecordTradeDialog, { validateExecuteInput } from "@/components/signals/RecordTradeDialog";
import CloseTradeDialog from "@/components/signals/CloseTradeDialog";
import SignalCard from "@/components/signals/SignalCard";
import { backendRuntime, jsonResponse, runtimeReport } from "./helpers";

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

type Route = (url: string, init: RequestInit) => Response | Promise<Response> | undefined;
let routes: Route[] = [];
let calls: { url: string; init: RequestInit }[] = [];

function serve(report: RuntimeReport, ...extra: Route[]) {
  routes = [
    ...extra,
    (url) => (url === "/api/runtime" ? jsonResponse(200, report) : undefined),
    (url) =>
      url === "/api/backend/meta/tiers"
        ? jsonResponse(200, { spec_hash: "f553ce3d", policy: "weighted-v1", tiers: [], scoring: { thresholds: { STANDARD: 55 } } })
        : undefined,
  ];
}

beforeEach(() => {
  calls = [];
  toastMock.error.mockReset();
  toastMock.success.mockReset();
  __setRuntimeStateForTests({ report: null, error: null, loading: true });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    for (const r of routes) {
      const res = await r(url, init);
      if (res) return res;
    }
    return jsonResponse(404, { detail: `rute tes tidak ada: ${url}` });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const details: ScoreDetails = {
  policy: "weighted-v1",
  contract_hash: "f553ce3d",
  score: 66.7333,
  threshold: 55,
  positive_factors: [{ factor: "price_in_poi", points: 20 }, { factor: "net_rr", points: 1.7333 }],
  negative_factors: [],
  veto: [],
  tier_reason: "STANDARD: skor 66.7333 >= 55; hitungan konfluensi, tidak memprediksi hasil",
  groups: { entry: 20, rr: 1.7333 },
  confidence_calibrated: false,
};

function signal(over: Partial<Signal> = {}): Signal {
  return {
    id: 4329,
    ticker: "LDOUSDT",
    display: "LDO/USDT",
    submarket: "Crypto",
    market: "crypto",
    tier: "STANDARD",
    action: "BUY",
    direction: "LONG",
    entry: 1.2,
    stop_loss: 1.1,
    take_profit: 1.4,
    rr_ratio: 2,
    confidence: 37,
    evidence_pct: 67,
    score_details: details,
    risk_idr: 100_000,
    position_idr: 1_000_000,
    gates_passed: ["price_in_poi"],
    gates_failed: [],
    wyckoff: null,
    reason: "",
    ...over,
  };
}

const openTrade: Trade = {
  id: 1,
  signal_id: 4329,
  ticker: "LDOUSDT",
  market: "crypto",
  tier: "STANDARD",
  entry: 1.2,
  stop_loss: 1.1,
  take_profit: 1.4,
  exit_price: null,
  units: 10,
  risk_idr: 100_000,
  pnl_idr: null,
  outcome: "open",
  opened_at: "2026-10-04T00:00:00Z",
  closed_at: null,
  notes: "",
};

describe("makna skor", () => {
  it("menyebut kebijakan + hash kontrak, dan menyatakan bukan probabilitas profit", () => {
    render(<WeightedExplanation details={details} />);
    const box = screen.getByTestId("weighted-explanation");
    expect(within(box).getByText("weighted-v1 · f553ce3d")).toBeTruthy();
    expect(box.textContent).toContain("66,7/100");
    expect(box.textContent).toContain("BUKAN probabilitas profit");
    expect(box.textContent).toContain("belum dikalibrasi");
  });

  it("sinyal kontrak lama tidak ditafsirkan dengan ambang kontrak aktif", () => {
    render(
      <WeightedExplanation
        details={{ ...details, contract_hash: "11111111" }}
        metadata={{ spec_hash: "f553ce3d", tiers: [], scoring: { thresholds: { STANDARD: 55 } } }}
      />,
    );
    const box = screen.getByTestId("weighted-explanation");
    expect(box.textContent).toContain("kontrak aktif kini");
    expect(box.textContent).not.toContain("STANDARD ≥ 55");
  });

  it("kartu sinyal: badge skor berlabel kebijakan, bukan peluang", async () => {
    serve(runtimeReport({ backend: { runtime: backendRuntime({ mode: "live", paper_trade: false }) } }));
    render(<SignalCard signal={signal()} onTrade={() => undefined} />);
    expect(screen.getByText("skor 66,7/100")).toBeTruthy();
    expect(screen.getByText("weighted-v1 · bukan peluang")).toBeTruthy();
  });

  it("kebijakan skor tak dikenal tidak dijelaskan dengan aturan lama", () => {
    serve(runtimeReport());
    render(<SignalCard signal={signal({ score_details: { ...details, policy: "weighted-v2" } })} />);
    expect(screen.getAllByText(/weighted-v2/).length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain("belum dikenali");
    expect(screen.queryByTestId("weighted-explanation")).toBeNull();
  });
});

describe("istilah & identitas runtime", () => {
  it("glosarium memakai lantai vonis dari backend, bukan salinan lokal", () => {
    const rt = backendRuntime({
      evaluation_floor: { min_terminal: 123, min_days: 45, min_blocks: 6, max_ci_half_width_r: 0.2, block_days: { Crypto: 14 } },
    });
    render(<MetricGlossary runtime={rt} />);
    const forward = document.querySelector('[data-term="forward"]')!.textContent!;
    expect(forward).toContain("≥123");
    expect(forward).toContain("≥45 hari");
    expect(forward).toContain("≥6 blok");
    expect(forward).toContain("≤0.2R");
    expect(document.querySelector('[data-term="ml"]')!.textContent).toContain("tidak dipakai scanner");
    expect(document.querySelector('[data-term="winrate"]')!.textContent).toContain("bukan hasil order nyata");
  });

  it("tanpa backend, glosarium mengaku tidak tahu alih-alih menebak", () => {
    render(<MetricGlossary runtime={null} />);
    expect(document.querySelector('[data-term="forward"]')!.textContent).toContain("belum bisa dibaca");
    expect(document.querySelector('[data-term="paper"]')!.textContent).toContain("belum diketahui");
    expect(document.querySelector('[data-term="confidence"]')!.textContent).toContain("tidak diketahui");
  });

  it("backend lama: nama kontrak dari /meta/tiers tetap dipakai glosarium", () => {
    render(
      <MetricGlossary
        runtime={null}
        contract={{ policy: "weighted-v1", spec_hash: "f553ce3d", confidence_calibrated: false }}
      />,
    );
    expect(document.querySelector('[data-term="skor"]')!.textContent).toContain("weighted-v1 (kontrak f553ce3d)");
    expect(document.querySelector('[data-term="confidence"]')!.textContent).toContain("Belum dikalibrasi");
  });

  it("panel identitas: build ID, mode, kontrak, dan sumber≠build terlihat", () => {
    render(
      <RuntimeIdentityPanel
        report={runtimeReport({
          frontend: { source_matches_build: false, source_hash_now: "9999999999999999" },
          backend: { runtime: backendRuntime({ config: { ...backendRuntime().config, write_auth_required: true } }) },
          proxy: { write_token_configured: false },
        })}
      />,
    );
    const text = document.body.textContent!;
    expect(text).toContain("f2c7c41-d5b7fa6d163");
    expect(text).toContain("PAPER");
    expect(text).toContain("weighted-v1 · f553ce3d");
    expect(text).toContain("TIDAK — sumber di disk kini 9999999999999999");
    expect(text).toContain("BELUM terpasang di server frontend");
  });

  it("chip header: API terhubung + PAPER + build", async () => {
    serve(runtimeReport());
    render(<RuntimeStatusChip />);
    const chip = await screen.findByTestId("runtime-chip");
    await waitFor(() => expect(chip.textContent).toContain("API terhubung"));
    expect(chip.textContent).toContain("PAPER");
    expect(chip.textContent).toContain("f2c7c41-d5b7fa6d163");
    expect(chip.getAttribute("href")).toBe("/settings");
  });

  it("chip header: backend mati terlihat sebagai terputus", async () => {
    serve(runtimeReport({ backend: { status: "unreachable", runtime: null, error: "ECONNREFUSED" } }));
    render(<RuntimeStatusChip />);
    const chip = await screen.findByTestId("runtime-chip");
    await waitFor(() => expect(chip.textContent).toContain("API terputus"));
    expect(chip.textContent).not.toContain("PAPER");
  });
});

describe("galat vs kosong", () => {
  it("ApiErrorNotice menjelaskan 409 dan jaringan", () => {
    const conflict = new ApiError({ status: 409, kind: "conflict", detail: "Trade ID 1 sudah ditutup", method: "PUT", path: "/trades/1/close" });
    const { unmount } = render(<ApiErrorNotice error={conflict} action="menutup trade" />);
    expect(screen.getByRole("alert").textContent).toContain("konflik keadaan (409)");
    unmount();
    const net = new ApiError({ status: null, kind: "network", detail: "Failed to fetch", method: "GET", path: "/stats" });
    render(<ApiErrorNotice error={net} />);
    expect(screen.getByRole("alert").textContent).toContain("server UI tidak terjangkau");
  });

  it("EmptyState adalah status, bukan alert", () => {
    render(<EmptyState title="Belum ada trade tercatat di jurnal." />);
    expect(screen.getByRole("status").textContent).toContain("Belum ada trade");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("dialog pencatatan & penutupan", () => {
  it("validasi lokal mengikuti kontrak backend (units > 0, finite; catatan ≤ 2000)", () => {
    expect(validateExecuteInput("0", "")).toMatch(/lebih besar dari 0/);
    expect(validateExecuteInput("-1", "")).toMatch(/lebih besar dari 0/);
    expect(validateExecuteInput("abc", "")).toMatch(/lebih besar dari 0/);
    expect(validateExecuteInput("Infinity", "")).toMatch(/lebih besar dari 0/);
    expect(validateExecuteInput("1", "x".repeat(2001))).toMatch(/2000/);
    expect(validateExecuteInput("0.5", "ok")).toBeNull();
  });

  it("mode paper: penjelasan tampil dan tombol simpan nonaktif", async () => {
    serve(runtimeReport());
    render(<RecordTradeDialog signal={signal()} onClose={() => undefined} onDone={() => undefined} />);
    await screen.findByTestId("paper-mode-dialog-notice");
    const save = screen.getByRole("button", { name: "Record Trade" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it("mode live: input tidak sah tidak dikirim; 422 dan 403-paper dijelaskan", async () => {
    let reply: Response = jsonResponse(422, {
      detail: [{ loc: ["body", "units"], msg: "Input should be greater than 0", type: "greater_than" }],
    });
    serve(
      runtimeReport({ backend: { runtime: backendRuntime({ mode: "live", paper_trade: false }) } }),
      (url) => (url === "/api/backend/trades/execute" ? reply : undefined),
    );
    render(<RecordTradeDialog signal={signal()} onClose={() => undefined} onDone={() => undefined} />);
    await waitFor(() => expect(calls.some((c) => c.url === "/api/runtime")).toBe(true));
    const input = screen.getByRole("spinbutton");
    const save = screen.getByRole("button", { name: "Record Trade" });

    fireEvent.change(input, { target: { value: "0" } });
    await act(async () => fireEvent.click(save));
    expect(toastMock.error).toHaveBeenLastCalledWith("Units harus angka lebih besar dari 0.");
    expect(calls.some((c) => c.url === "/api/backend/trades/execute")).toBe(false);

    fireEvent.change(input, { target: { value: "2" } });
    await act(async () => fireEvent.click(save));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenLastCalledWith(
        "Input ditolak validasi server (422)",
        expect.objectContaining({ description: expect.stringContaining("Units: Input should be greater than 0") }),
      ),
    );

    reply = jsonResponse(403, { detail: "Paper-trade mode aktif: pencatatan eksekusi live dinonaktifkan." });
    await act(async () => fireEvent.click(save));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenLastCalledWith(
        "Tidak bisa mencatat trade: mode paper aktif",
        expect.anything(),
      ),
    );
  });

  it("tutup trade: harga tidak sah ditolak lokal; 409 memuat ulang & menutup dialog", async () => {
    serve(runtimeReport(), (url) =>
      url === "/api/backend/trades/1/close" ? jsonResponse(409, { detail: "Trade ID 1 sudah ditutup" }) : undefined,
    );
    const onDone = vi.fn();
    const onClose = vi.fn();
    render(<CloseTradeDialog trade={openTrade} onClose={onClose} onDone={onDone} />);
    const input = screen.getByRole("spinbutton");
    const btn = screen.getByRole("button", { name: "Close Trade" });

    fireEvent.change(input, { target: { value: "-5" } });
    await act(async () => fireEvent.click(btn));
    expect(toastMock.error).toHaveBeenLastCalledWith("Harga exit harus angka lebih besar dari 0.");
    expect(calls.some((c) => c.url.includes("/trades/1/close"))).toBe(false);

    fireEvent.change(input, { target: { value: "1.5" } });
    await act(async () => fireEvent.click(btn));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(toastMock.error.mock.calls.at(-1)?.[0]).toContain("409");
    const put = calls.find((c) => c.url === "/api/backend/trades/1/close")!;
    expect(put.init.method).toBe("PUT");
    expect(new Headers(put.init.headers).has("authorization")).toBe(false);
  });

  it("kartu sinyal di mode paper menggantikan tombol Record dengan penjelasan", async () => {
    serve(runtimeReport());
    render(<SignalCard signal={signal()} onTrade={() => undefined} />);
    await screen.findByTestId("paper-mode-record-notice");
    expect(screen.queryByRole("button", { name: "Record Trade" })).toBeNull();
  });
});
