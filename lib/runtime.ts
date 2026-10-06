"use client";

/**
 * Status runtime bersama untuk seluruh UI (chip header, dialog, halaman
 * Sistem). Satu polling untuk semua pembaca, bukan satu per komponen.
 */
import { useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api-error";
import type { RuntimeReport } from "@/types/runtime";

export const RUNTIME_ENDPOINT = "/api/runtime";
const POLL_MS = 30_000;

export interface RuntimeState {
  report: RuntimeReport | null;
  /** Galat saat menghubungi server frontend sendiri (bukan backend). */
  error: ApiError | null;
  loading: boolean;
}

let state: RuntimeState = { report: null, error: null, loading: true };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let inflight: Promise<void> | null = null;

function emit(next: RuntimeState) {
  state = next;
  listeners.forEach((l) => l());
}

export async function fetchRuntimeReport(
  fetchImpl: typeof fetch = (...a) => fetch(...a),
  url = RUNTIME_ENDPOINT,
): Promise<RuntimeReport> {
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  } catch (e) {
    throw new ApiError({
      status: null,
      kind: "network",
      detail: e instanceof Error ? e.message : String(e),
      method: "GET",
      path: url,
    });
  }
  if (!res.ok) {
    throw new ApiError({
      status: res.status,
      kind: res.status >= 500 ? "server" : "forbidden",
      detail: (await res.text()).slice(0, 200),
      method: "GET",
      path: url,
    });
  }
  return (await res.json()) as RuntimeReport;
}

export function refreshRuntime(): Promise<void> {
  if (inflight) return inflight;
  emit({ ...state, loading: true });
  inflight = fetchRuntimeReport()
    .then((report) => emit({ report, error: null, loading: false }))
    .catch((e: unknown) =>
      emit({
        report: state.report,
        error: e instanceof ApiError ? e : null,
        loading: false,
      }),
    )
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    void refreshRuntime();
    timer = setInterval(() => void refreshRuntime(), POLL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const SERVER_STATE: RuntimeState = { report: null, error: null, loading: true };

export function useRuntime(): RuntimeState & { refresh: () => Promise<void> } {
  // Langganan sendiri yang memicu polling; tidak perlu efek tambahan.
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  return { ...snapshot, refresh: refreshRuntime };
}

/** Mode eksekusi yang DIKETAHUI; null bila backend belum menjawab. */
export function executionMode(report: RuntimeReport | null): "paper" | "live" | null {
  return report?.backend.runtime?.mode ?? null;
}

/** Untuk tes. */
export function __setRuntimeStateForTests(next: RuntimeState) {
  emit(next);
}
