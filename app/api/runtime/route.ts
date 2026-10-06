import { backendConfigFromEnv, guardRequest, jsonResponse } from "@/lib/server/backend";
import { buildRuntimeReport } from "@/lib/server/runtime";

// Endpoint diagnostik: identitas build frontend + status/identitas backend.
// Tidak memuat token; hanya menyatakan apakah token write terpasang.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const cfg = backendConfigFromEnv();
  const rejected = guardRequest(request, cfg);
  if (rejected) return jsonResponse(403, { detail: rejected, kind: "proxy_forbidden" });
  return jsonResponse(200, await buildRuntimeReport(cfg));
}
