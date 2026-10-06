import { proxyToBackend } from "@/lib/server/backend";

// Proxy same-origin ke backend API. Lihat lib/server/backend.ts untuk alasan
// dan pagarnya. Selalu dinamis: tidak ada jawaban backend yang di-cache.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(request: Request, { params }: Ctx) {
  const { path } = await params;
  return proxyToBackend(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
