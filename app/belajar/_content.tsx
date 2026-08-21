"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BookOpen, Info, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  GateCard,
  GateCardsResponse,
  GlossaryResponse,
} from "@/types";

/**
 * Render `**tebal**` dan `` `kode` `` dari konten backend.
 *
 * Kalimat yang di-bold di `education_content.py` adalah intisari tiap konsep
 * ("**Ini target yang benar, bukan winrate**", "**lift bukan properti gate**"),
 * dan backtick dipakai untuk nama kode (`SRDetector`, `--measure-gate`).
 * Menampilkannya sebagai asterisk dan backtick mentah membuang penekanan yang
 * justru paling ingin dibaca. Sengaja hanya dua bentuk itu — bukan parser
 * markdown penuh, karena kontennya memang hanya memakai keduanya.
 */
/** Backtick bisa berada DI DALAM teks tebal, jadi kode dirender terpisah dan
 *  dipakai ulang oleh kedua cabang — bukan satu regex bergantian. */
function CodeSpans({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((part, i) =>
        part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
          <code
            key={i}
            className="px-1 py-0.5 rounded bg-secondary text-[0.9em] text-foreground/90"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*.+?\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-foreground">
            <CodeSpans text={part.slice(2, -2)} />
          </strong>
        ) : (
          <CodeSpans key={i} text={part} />
        ),
      )}
    </>
  );
}

/** Vonis "tak terukur (…)" diberi warna berbeda dari "sampel kurang" —
 *  yang satu tertolong data tambahan, yang lain tidak. Menyamakan warnanya
 *  akan menyamarkan perbedaan yang justru paling penting. */
export function verdictStyle(verdict: string): string {
  if (verdict === "positif")
    return "bg-emerald-400/10 text-emerald-400 border-emerald-400/20";
  if (verdict === "negatif")
    return "bg-destructive/10 text-destructive border-destructive/20";
  if (verdict.startsWith("tak terukur") || verdict === "tak ada di vektor")
    return "bg-violet-400/10 text-violet-400 border-violet-400/20";
  return "bg-secondary text-muted-foreground border-border";
}

export function RoleBadge({ card }: { card: GateCard }) {
  const s = card.structure;
  if (s.is_absolute_veto)
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded border bg-destructive/10 text-destructive border-destructive/20">
        VETO ABSOLUT
      </span>
    );
  if (s.is_candidate)
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded border bg-amber-400/10 text-amber-400 border-amber-400/20">
        KANDIDAT
      </span>
    );
  if (s.mandatory_in.length > 0)
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded border bg-primary/10 text-primary border-primary/20">
        WAJIB {s.mandatory_in.length} TIER
      </span>
    );
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded border bg-secondary text-muted-foreground border-border">
      OPSIONAL
    </span>
  );
}

/** Satu baris pengukuran — angka TIDAK PERNAH tampil tanpa n, CI, vonis,
 *  model level, dan sidik jari data (aturan §7.6). */
export function MeasurementRow({
  m,
}: {
  m: GateCard["measured"] extends (infer T)[] | null ? T : never;
}) {
  const lift = m.lift_pp;
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-medium">
          {m.context.market} · {m.context.mode}
        </span>
        <span
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded border",
            verdictStyle(m.verdict),
          )}
        >
          {m.verdict}
        </span>
      </div>

      {lift == null ? (
        <p className="text-[11px] text-muted-foreground">
          Lift tak bisa dihitung — salah satu cabang tidak ada.
          {m.remedy ? ` ${m.remedy}` : ""}
        </p>
      ) : (
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className={cn(
              "text-lg font-bold tabular-nums",
              lift > 0
                ? "text-emerald-400"
                : lift < 0
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            {lift > 0 ? "+" : ""}
            {lift} pp
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            ON {m.win_rate_on}% (n={m.n_on}
            {m.ci_on?.[0] != null ? `, CI ${m.ci_on[0]}–${m.ci_on[1]}` : ""}) ·
            OFF {m.win_rate_off}% (n={m.n_off}
            {m.ci_off?.[0] != null ? `, CI ${m.ci_off[0]}–${m.ci_off[1]}` : ""})
          </span>
        </div>
      )}

      {m.verdict_correction && (
        <p className="text-[10px] text-amber-400 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          {m.verdict_correction}
        </p>
      )}

      {/* Konteks wajib — tanpa ini angka di atas tidak bisa dibaca. */}
      <p className="text-[10px] text-muted-foreground/70 tabular-nums">
        model level {m.context.levels_model} · {m.context.years}th{" "}
        {m.context.interval} · {m.context.tickers} ticker · data{" "}
        {m.context.data_fingerprint ?? "?"}
      </p>
    </div>
  );
}

function GateCardView({ card }: { card: GateCard }) {
  const [open, setOpen] = useState(false);
  const c = card.content;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm">
            {c?.judul ?? card.gate}
          </h3>
          <code className="text-[10px] text-muted-foreground">{card.gate}</code>
        </div>
        <RoleBadge card={card} />
      </div>

      {c ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {c.definisi}
        </p>
      ) : (
        <p className="text-xs text-amber-400">
          Gate ini menentukan tier tapi belum punya kartu penjelasan.
        </p>
      )}

      {/* Angka terukur — atau pernyataan jujur bahwa belum ada. */}
      {card.measured ? (
        <div className="space-y-1.5">
          {card.measured.map((m, i) => (
            <MeasurementRow key={i} m={m} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground italic border border-dashed border-border rounded-lg p-2">
          Belum ada run backtest yang sah untuk gate ini. &ldquo;Belum
          diukur&rdquo; bukan berarti nol.
        </p>
      )}

      <p className="text-[11px] text-foreground/80 flex items-start gap-1.5 border-l-2 border-primary/40 pl-2">
        <Info className="w-3 h-3 shrink-0 mt-0.5 text-primary" />
        <span>
          <RichText text={card.teaching_note} />
        </span>
      </p>

      {c && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-[11px] text-primary hover:underline"
          >
            {open ? "Sembunyikan detail" : "Cara dihitung & salah kaprah →"}
          </button>
          {open && (
            <div className="space-y-2 text-[11px] pt-1">
              <Detail label="Cara dihitung" body={c.cara_dihitung} />
              <Detail
                label="Cara membacanya di chart"
                body={c.cara_membaca_di_chart}
              />
              <Detail
                label="Salah kaprah"
                body={c.salah_kaprah}
                tone="amber"
              />
              <Detail
                label="Catatan sistem ini"
                body={c.catatan_sistem}
                tone="muted"
              />
              <p className="text-[10px] text-muted-foreground">
                {card.structure.role_summary}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Detail({
  label,
  body,
  tone = "default",
}: {
  label: string;
  body: string;
  tone?: "default" | "amber" | "muted";
}) {
  return (
    <div>
      <p
        className={cn(
          "font-semibold text-[10px] uppercase tracking-wide",
          tone === "amber" ? "text-amber-400" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "leading-relaxed",
          tone === "muted" ? "text-muted-foreground" : "text-foreground/80",
        )}
      >
        <RichText text={body} />
      </p>
    </div>
  );
}

export default function BelajarContent() {
  const [data, setData] = useState<GateCardsResponse | null>(null);
  const [glossary, setGlossary] = useState<GlossaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"gate" | "konsep">("gate");

  useEffect(() => {
    let alive = true;
    api.education
      .gates()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(String(e)));
    api.education
      .glossary()
      .then((d) => alive && setGlossary(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (error)
    return (
      <p className="text-sm text-destructive">
        Gagal memuat materi: {error}
      </p>
    );
  if (!data)
    return <p className="text-sm text-muted-foreground">Memuat…</p>;

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {(["gate", "konsep"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              tab === t
                ? "bg-primary/15 text-primary border-primary/25"
                : "border-border text-muted-foreground hover:bg-secondary",
            )}
          >
            {t === "gate" ? "Kartu gate" : "Konsep pengukuran"}
          </button>
        ))}
        {/* Replay bukan tab: ia halaman sendiri karena punya state sesi yang
            tidak boleh hilang saat pengguna berpindah tab. */}
        <Link
          href="/belajar/replay"
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:bg-secondary transition-all"
        >
          Replay →
        </Link>
      </div>

      {tab === "gate" ? (
        <>
          <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
              {data.disclaimer}
            </p>
            <p className="text-[10px] text-muted-foreground/80">
              Angka diambil dari {data.sources.length} run backtest yang sah:{" "}
              {data.sources
                .map((s) => `${s.market}/${s.mode} (${s.data_fingerprint})`)
                .join(", ") || "—"}
              .
              {data.excluded_runs.length > 0 && (
                <>
                  {" "}
                  <span className="text-amber-400">
                    {data.excluded_runs.length} run dikecualikan karena ditandai
                    tidak sah
                  </span>{" "}
                  — cakupan data kurang atau jendela antar-ticker tidak sejajar.
                </>
              )}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {data.gates.map((card) => (
              <GateCardView key={card.gate} card={card} />
            ))}
          </div>
        </>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {glossary?.terms.map((t) => (
            <div
              key={t.istilah}
              className="rounded-xl border border-border bg-card p-4 space-y-1.5"
            >
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                {t.istilah}
              </h3>
              <p className="text-xs text-primary/90">{t.ringkas}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <RichText text={t.isi} />
              </p>
            </div>
          )) ?? (
            <p className="text-sm text-muted-foreground">Memuat konsep…</p>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/60">
        Materi ini menjelaskan cara sistem ini bekerja dan apa yang terukur
        darinya — bukan saran investasi. Lihat juga{" "}
        <Link href="/report-card" className="text-primary hover:underline">
          Report Card
        </Link>{" "}
        untuk kalibrasi sistem secara keseluruhan.
      </p>
    </div>
  );
}
