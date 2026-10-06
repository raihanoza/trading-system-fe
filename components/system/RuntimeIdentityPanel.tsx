import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RuntimeReport } from "@/types/runtime";

type Tone = "ok" | "warn" | "bad" | "unknown";

const TONE_CLASS: Record<Tone, string> = {
  ok: "text-emerald-400",
  warn: "text-amber-400",
  bad: "text-destructive",
  unknown: "text-muted-foreground",
};

function ToneIcon({ tone }: { tone: Tone }) {
  const cls = cn("w-3.5 h-3.5 shrink-0", TONE_CLASS[tone]);
  if (tone === "ok") return <CheckCircle2 className={cls} />;
  if (tone === "warn") return <AlertTriangle className={cls} />;
  if (tone === "bad") return <XCircle className={cls} />;
  return <HelpCircle className={cls} />;
}

function Row({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  note?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,11rem)_1fr] gap-3 border-t border-border py-2 first:border-t-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-xs">
        <span className="flex items-start gap-1.5">
          {tone && <ToneIcon tone={tone} />}
          <span className="min-w-0 break-words font-mono text-foreground">{value}</span>
        </span>
        {note && <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>}
      </dd>
    </div>
  );
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`;
}

export function backendStatusLabel(report: RuntimeReport | null): { label: string; tone: Tone } {
  switch (report?.backend.status) {
    case "ok":
      return { label: "Terhubung", tone: "ok" };
    case "legacy":
      return { label: "Terhubung (versi lama, belum di-restart)", tone: "warn" };
    case "error":
      return { label: "Menjawab dengan galat", tone: "bad" };
    case "unreachable":
      return { label: "Tidak terhubung", tone: "bad" };
    default:
      return { label: "Belum diperiksa", tone: "unknown" };
  }
}

/** Tabel identitas runtime lengkap — halaman Sistem. */
export default function RuntimeIdentityPanel({ report }: { report: RuntimeReport }) {
  const fe = report.frontend;
  const be = report.backend;
  const rt = be.runtime;
  const status = backendStatusLabel(report);

  const sourceTone: Tone =
    fe.source_matches_build === true ? "ok" : fe.source_matches_build === false ? "bad" : "unknown";
  const changedTone: Tone =
    rt?.code.changed_since_start === false ? "ok" : rt?.code.changed_since_start ? "warn" : "unknown";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-border bg-card p-4" aria-label="Frontend">
        <h2 className="mb-2 text-sm font-semibold">Frontend (build yang sedang dilayani)</h2>
        <dl>
          <Row label="Build ID" value={fe.build_id} />
          <Row label="Waktu build" value={fmtTime(fe.built_at)} />
          <Row
            label="Commit sumber"
            value={fe.git_commit ? fe.git_commit.slice(0, 12) : "—"}
            note={
              fe.git_dirty
                ? `${fe.git_dirty_files} berkas belum di-commit ikut ter-build (branch ${fe.git_branch ?? "?"}) — commit saja bukan identitas build ini; gunakan sidik sumber.`
                : fe.git_dirty === false
                  ? `Working tree bersih (branch ${fe.git_branch ?? "?"}).`
                  : "Git tidak tersedia saat build."
            }
          />
          <Row
            label="Sidik sumber"
            value={`${fe.source_hash || "—"} (${fe.source_files} berkas)`}
          />
          <Row
            label="Sumber = build?"
            tone={sourceTone}
            value={
              fe.source_matches_build === true
                ? "Ya — sumber di disk sama dengan yang di-build"
                : fe.source_matches_build === false
                  ? `TIDAK — sumber di disk kini ${fe.source_hash_now}`
                  : "Tidak dapat diperiksa"
            }
            note={
              fe.source_matches_build === false
                ? "Perubahan sumber belum terlihat di browser sampai build ulang + restart frontend."
                : undefined
            }
          />
          <Row label="Next.js / Node" value={`${fe.next_version} · ${fe.node_version} · ${fe.node_env}`} />
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-4" aria-label="Backend">
        <h2 className="mb-2 text-sm font-semibold">Backend API</h2>
        <dl>
          <Row
            label="Koneksi API"
            tone={status.tone}
            value={status.label}
            note={
              be.error
                ? be.error
                : be.latency_ms != null
                  ? `${be.upstream} · ${be.latency_ms} ms (diperiksa dari server frontend)`
                  : be.upstream
            }
          />
          <Row
            label="Mode eksekusi"
            tone={rt ? (rt.mode === "paper" ? "ok" : "warn") : "unknown"}
            value={rt ? rt.mode.toUpperCase() : "tidak diketahui"}
            note={rt?.execution_note}
          />
          <Row
            label="Kontrak tier"
            value={be.contract ? `${be.contract.policy ?? "?"} · ${be.contract.spec_hash}` : "—"}
            note={
              be.contract
                ? `Skor bukan probabilitas profit. Confidence ${be.contract.confidence_calibrated ? "terkalibrasi" : "belum dikalibrasi"} untuk kontrak ini.` +
                  (be.contract.source === "meta/tiers" ? " (dibaca dari /meta/tiers)" : "")
                : undefined
            }
          />
          <Row
            label="Versi aplikasi"
            value={rt?.app_version ?? be.health?.version ?? "—"}
          />
          <Row
            label="Commit saat start"
            value={
              rt?.code.git_at_start?.commit
                ? `${rt.code.git_at_start.commit.slice(0, 12)} (${rt.code.git_at_start.branch ?? "detached"})`
                : "—"
            }
          />
          <Row
            label="Sidik kode saat start"
            value={
              rt
                ? `${rt.code.fingerprint_at_start.sha256_16} (${rt.code.fingerprint_at_start.files} berkas)`
                : "—"
            }
          />
          <Row
            label="Kode berubah sejak start?"
            tone={changedTone}
            value={
              rt?.code.changed_since_start === false
                ? "Tidak"
                : rt?.code.changed_since_start
                  ? `Ya — disk kini ${rt.code.fingerprint_now.sha256_16}`
                  : "—"
            }
            note={
              rt?.code.changed_since_start
                ? "Restart backend belum dilakukan sejak kode berubah, atau modul yang diimpor belakangan sudah memakai versi baru."
                : undefined
            }
          />
          <Row label="Proses mulai" value={fmtTime(rt?.process.started_at)} />
          <Row
            label="Otorisasi perubahan"
            value={
              rt
                ? rt.config.write_auth_required
                  ? report.proxy.write_token_configured
                    ? "Token wajib · terpasang di server frontend"
                    : "Token wajib · BELUM terpasang di server frontend (perubahan akan 401)"
                  : "Tidak diwajibkan backend"
                : report.proxy.write_token_configured
                  ? "Token terpasang di server frontend"
                  : "—"
            }
            tone={
              rt?.config.write_auth_required && !report.proxy.write_token_configured ? "bad" : undefined
            }
          />
        </dl>
      </section>
    </div>
  );
}
