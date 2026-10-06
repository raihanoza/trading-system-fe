/**
 * Kesalahan API yang sudah diklasifikasikan.
 *
 * Sampai 4 Okt 2026 setiap kegagalan dilempar sebagai
 * `Error("API 422: {\"detail\":[...]}")` dan teks mentah itu yang muncul di
 * toast. Pengguna tidak bisa membedakan "token ditolak", "trade sudah ditutup",
 * "input tidak sah", dan "backend mati" — padahal tindak lanjutnya berbeda.
 */

export type ApiErrorKind =
  | "network" // browser tidak bisa menghubungi server FE sama sekali
  | "backend_unreachable" // server FE hidup, backend API tidak menjawab
  | "backend_timeout"
  | "bad_request"
  | "unauthorized" // 401 — token write ditolak / belum dipasang di server FE
  | "paper_mode" // 403 khusus: eksekusi live dinonaktifkan mode paper
  | "forbidden"
  | "not_found"
  | "conflict" // 409 — mis. trade sudah ditutup
  | "validation" // 422 — input ditolak validasi server
  | "too_large"
  | "server" // 5xx dari backend
  | "bad_response"; // 2xx tapi bukan JSON yang sah

export interface ValidationIssue {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number | null;
  readonly kind: ApiErrorKind;
  readonly detail: string;
  readonly issues: ValidationIssue[];
  readonly method: string;
  readonly path: string;

  constructor(init: {
    status: number | null;
    kind: ApiErrorKind;
    detail: string;
    issues?: ValidationIssue[];
    method: string;
    path: string;
  }) {
    super(
      `${init.method} ${init.path} → ${init.status ?? "jaringan"}: ${init.detail}`,
    );
    this.name = "ApiError";
    this.status = init.status;
    this.kind = init.kind;
    this.detail = init.detail;
    this.issues = init.issues ?? [];
    this.method = init.method;
    this.path = init.path;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** FastAPI: `detail` bisa string, atau daftar galat validasi Pydantic. */
export function parseErrorBody(body: unknown): {
  detail: string;
  issues: ValidationIssue[];
  proxyKind: string | null;
} {
  if (!body || typeof body !== "object") {
    return {
      detail: typeof body === "string" && body.trim() ? body.trim().slice(0, 300) : "",
      issues: [],
      proxyKind: null,
    };
  }
  const b = body as { detail?: unknown; kind?: unknown };
  const proxyKind = typeof b.kind === "string" ? b.kind : null;
  if (typeof b.detail === "string") {
    return { detail: b.detail, issues: [], proxyKind };
  }
  if (Array.isArray(b.detail)) {
    const issues = b.detail.map((raw) => {
      const item = (raw ?? {}) as { loc?: unknown; msg?: unknown };
      const loc = Array.isArray(item.loc)
        ? item.loc.filter((p) => p !== "body" && p !== "query" && p !== "path")
        : [];
      return {
        field: loc.length ? loc.join(".") : "(permintaan)",
        message: typeof item.msg === "string" ? item.msg : "tidak sah",
      };
    });
    return {
      detail: issues.map((i) => `${i.field}: ${i.message}`).join("; "),
      issues,
      proxyKind,
    };
  }
  return { detail: "", issues: [], proxyKind };
}

export function kindForStatus(
  status: number,
  detail: string,
  proxyKind: string | null,
): ApiErrorKind {
  if (proxyKind === "upstream_unreachable") return "backend_unreachable";
  if (proxyKind === "upstream_timeout") return "backend_timeout";
  if (status === 401) return "unauthorized";
  if (status === 403) return /paper/i.test(detail) ? "paper_mode" : "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 413) return "too_large";
  if (status === 422) return "validation";
  if (status === 502 || status === 503) return "backend_unreachable";
  if (status === 504) return "backend_timeout";
  if (status >= 500) return "server";
  return "bad_request";
}

export interface ErrorDescription {
  title: string;
  description: string;
  /** Langkah yang bisa diambil pengguna; null bila tidak ada. */
  hint: string | null;
}

/**
 * Kalimat untuk pengguna. `action` = apa yang sedang dicoba, mis.
 * "mencatat trade" — dipakai di judul supaya toast bisa berdiri sendiri.
 */
export function describeApiError(e: unknown, action = "memuat data"): ErrorDescription {
  if (!isApiError(e)) {
    return {
      title: `Gagal ${action}`,
      description: e instanceof Error ? e.message : "Kesalahan tidak dikenal.",
      hint: null,
    };
  }
  const detail = e.detail ? ` Pesan server: “${e.detail}”.` : "";
  switch (e.kind) {
    case "network":
      return {
        title: `Gagal ${action}: server UI tidak terjangkau`,
        description: "Browser tidak mendapat jawaban dari server frontend.",
        hint: "Periksa apakah layanan frontend berjalan, lalu muat ulang halaman.",
      };
    case "backend_unreachable":
      return {
        title: `Gagal ${action}: backend API tidak terhubung`,
        description: `Server frontend hidup, tetapi backend API tidak menjawab.${detail}`,
        hint: "Periksa layanan TradingSystemAPI (port 4010). Status rinci ada di halaman Sistem.",
      };
    case "backend_timeout":
      return {
        title: `Gagal ${action}: backend terlalu lama menjawab`,
        description: `Permintaan dihentikan karena melewati batas waktu.${detail}`,
        hint: "Scan bisa memakan beberapa menit; coba lagi dan periksa log API bila berulang.",
      };
    case "unauthorized":
      return {
        title: `Gagal ${action}: otorisasi ditolak (401)`,
        description:
          "Backend mewajibkan token untuk perubahan data dan token dari server frontend tidak cocok atau belum dipasang.",
        hint:
          "Isi API_WRITE_TOKEN di .env.production.local frontend (sama dengan backend), lalu restart frontend. Token tidak pernah disimpan di browser.",
      };
    case "paper_mode":
      return {
        title: `Tidak bisa ${action}: mode paper aktif`,
        description:
          "Backend berjalan dalam mode paper; pencatatan eksekusi live dinonaktifkan karena edge belum terbukti.",
        hint: "Sinyal tetap dicatat dan diukur otomatis oleh resolver — tidak perlu dicatat manual.",
      };
    case "forbidden":
      return {
        title: `Gagal ${action}: ditolak (403)`,
        description: `Permintaan ditolak.${detail}`,
        hint: null,
      };
    case "not_found":
      return {
        title: `Gagal ${action}: tidak ditemukan (404)`,
        description: `Data atau endpoint tidak ada.${detail}`,
        hint: "Bila endpoint baru, backend mungkin belum di-restart ke versi terbaru.",
      };
    case "conflict":
      return {
        title: `Tidak bisa ${action}: konflik keadaan (409)`,
        description: `Data sudah berubah di server.${detail}`,
        hint: "Muat ulang daftar untuk melihat keadaan terbaru.",
      };
    case "validation":
      return {
        title: `Input ditolak validasi server (422)`,
        description: e.issues.length
          ? e.issues.map((i) => `${fieldLabel(i.field)}: ${i.message}`).join("; ")
          : `Server menolak isi permintaan.${detail}`,
        hint: "Perbaiki isian lalu kirim ulang.",
      };
    case "too_large":
      return {
        title: `Gagal ${action}: permintaan terlalu besar`,
        description: `Isi permintaan melewati batas.${detail}`,
        hint: null,
      };
    case "server":
      return {
        title: `Gagal ${action}: galat server (${e.status})`,
        description: `Backend mengalami kesalahan internal.${detail}`,
        hint: "Lihat log TradingSystemAPI untuk rinciannya.",
      };
    case "bad_response":
      return {
        title: `Gagal ${action}: respons tidak terbaca`,
        description: "Server menjawab, tetapi isinya bukan JSON yang sah.",
        hint: "Kemungkinan versi frontend dan backend tidak cocok.",
      };
    case "bad_request":
    default:
      return {
        title: `Gagal ${action} (${e.status ?? "?"})`,
        description: `Permintaan ditolak.${detail}`,
        hint: null,
      };
  }
}

const FIELD_LABELS: Record<string, string> = {
  units: "Units",
  exit_price: "Harga exit",
  notes: "Catatan",
  signal_id: "ID sinyal",
  pnl_idr: "P&L",
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}
