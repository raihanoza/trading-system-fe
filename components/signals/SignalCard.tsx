"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

import {
  Signal,
  Trade,
  PortfolioRisk,
  TIER_CONFIG,
  MARKET_CONFIG,
  TierMeta,
} from "@/types";
import {
  formatIDR,
  formatPrice,
  isStale,
  timeAgo,
  STALE_AFTER_DAYS,
} from "@/lib/utils";
import { cn } from "@/lib/utils";
import { api, getTierSpecs } from "@/lib/api";
import { computeTierLadder, tierSpec, type TierLadder } from "@/lib/tiers";
import { formatGateLabel, getGateDescription } from "@/lib/gates";
import {
  TrendingUp,
  TrendingDown,
  Shield,
  Target,
  AlertTriangle,
  Newspaper,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Clock,
} from "lucide-react";

interface Props {
  signal: Signal;
  onTrade?: (signal: Signal) => void;
}

// ── Sentiment Flag (unchanged) ────────────────────────────────────────────────

interface SentimentData {
  score: number;
  label: string;
  flag: string;
  confidence: number;
  headline_count: number;
  bullish_count: number;
  bearish_count: number;
  signal_conflict: boolean;
  conflict_severity: string;
  conflict_message: string;
  top_headlines?: { title: string; source: string; score: number }[];
}

function SentimentFlag({ sentiment }: { sentiment: SentimentData }) {
  const [showDetail, setShowDetail] = useState(false);
  const bgColor =
    sentiment.signal_conflict && sentiment.conflict_severity === "severe"
      ? "bg-red-500/15 border-red-500/40"
      : sentiment.signal_conflict && sentiment.conflict_severity === "moderate"
        ? "bg-orange-500/15 border-orange-500/40"
        : sentiment.label === "STRONG_BULLISH"
          ? "bg-emerald-500/10 border-emerald-500/25"
          : sentiment.label === "BULLISH"
            ? "bg-green-500/10 border-green-500/20"
            : sentiment.label === "STRONG_BEARISH"
              ? "bg-red-500/10 border-red-500/25"
              : sentiment.label === "BEARISH"
                ? "bg-red-400/10 border-red-400/20"
                : "bg-secondary/50 border-border";
  const textColor = sentiment.signal_conflict
    ? "text-orange-400"
    : sentiment.label.includes("BULLISH")
      ? "text-emerald-400"
      : sentiment.label.includes("BEARISH")
        ? "text-red-400"
        : "text-muted-foreground";
  const barPct = ((sentiment.score + 1) / 2) * 100;
  const barColor =
    sentiment.score >= 0.15
      ? "bg-emerald-500"
      : sentiment.score <= -0.15
        ? "bg-red-500"
        : "bg-yellow-500";

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 mb-3 cursor-pointer transition-all",
        bgColor,
      )}
      onClick={() => setShowDetail((d) => !d)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Newspaper className="w-3 h-3 text-muted-foreground shrink-0" />
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wide shrink-0",
              textColor,
            )}
          >
            {sentiment.flag} {sentiment.label.replace(/_/g, " ")}
          </span>
          {sentiment.signal_conflict && (
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-md border shrink-0",
                sentiment.conflict_severity === "severe"
                  ? "text-red-400 bg-red-500/10 border-red-500/30"
                  : sentiment.conflict_severity === "moderate"
                    ? "text-orange-400 bg-orange-500/10 border-orange-500/30"
                    : "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
              )}
            >
              ⚠️ CONFLICT
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-16 h-1.5 rounded-full bg-secondary/80 overflow-hidden hidden sm:block">
            <div
              className={cn("h-full rounded-full", barColor)}
              style={{ width: `${barPct}%` }}
            />
          </div>
          <span className={cn("text-[10px] font-mono", textColor)}>
            {sentiment.score > 0 ? "+" : ""}
            {sentiment.score.toFixed(2)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {sentiment.headline_count}h
          </span>
        </div>
      </div>

      {showDetail && (
        <div className="mt-2 pt-2 border-t border-border/30 space-y-1.5">
          {sentiment.headline_count > 0 && (
            <div className="space-y-1">
              <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                <div
                  className="bg-emerald-500/70"
                  style={{
                    width: `${(sentiment.bullish_count / sentiment.headline_count) * 100}%`,
                  }}
                />
                <div
                  className="bg-yellow-500/40"
                  style={{
                    width: `${((sentiment.headline_count - sentiment.bullish_count - sentiment.bearish_count) / sentiment.headline_count) * 100}%`,
                  }}
                />
                <div
                  className="bg-red-500/70"
                  style={{
                    width: `${(sentiment.bearish_count / sentiment.headline_count) * 100}%`,
                  }}
                />
              </div>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span className="text-emerald-400">
                  {sentiment.bullish_count} bull
                </span>
                <span className="text-red-400">
                  {sentiment.bearish_count} bear
                </span>
                <span>
                  {sentiment.headline_count -
                    sentiment.bullish_count -
                    sentiment.bearish_count}{" "}
                  neutral
                </span>
              </div>
            </div>
          )}
          {sentiment.signal_conflict && sentiment.conflict_message && (
            <p className="text-[10px] text-orange-300 leading-relaxed">
              {sentiment.conflict_message}
            </p>
          )}
          {sentiment.top_headlines && sentiment.top_headlines.length > 0 && (
            <div className="space-y-1">
              {sentiment.top_headlines.slice(0, 2).map((h, i) => (
                <div
                  key={i}
                  className="text-[10px] text-muted-foreground line-clamp-1"
                >
                  <span
                    className={
                      h.score >= 0.15
                        ? "text-emerald-400"
                        : h.score <= -0.15
                          ? "text-red-400"
                          : ""
                    }
                  >
                    {h.score > 0 ? "+" : ""}
                    {h.score.toFixed(2)}
                  </span>
                  {" · "}
                  {h.title}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Gates Detail Component ────────────────────────────────────────────────────

function GatesDetail({
  passed,
  failed,
}: {
  passed: string[];
  failed: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const total = passed.length + failed.length;
  const passRate = total > 0 ? (passed.length / total) * 100 : 0;

  if (total === 0) {
    return (
      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 mb-3 text-xs text-muted-foreground">
        No gate data available
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-secondary/30 mb-3 overflow-hidden">
      {/* Header — clickable to expand */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold text-foreground">
            Gates:{" "}
            <span
              className={cn(
                "font-mono",
                passRate >= 75
                  ? "text-emerald-400"
                  : passRate >= 50
                    ? "text-yellow-400"
                    : "text-red-400",
              )}
            >
              {passed.length}/{total}
            </span>
          </span>

          {/* Dot indicators */}
          <div className="flex gap-0.5">
            {passed.slice(0, 6).map((g) => (
              <span
                key={g}
                className="w-1.5 h-1.5 rounded-full bg-emerald-400/70"
                title={`✓ ${formatGateLabel(g)}`}
              />
            ))}
            {failed.slice(0, 6).map((g) => (
              <span
                key={g}
                className="w-1.5 h-1.5 rounded-full bg-red-400/40"
                title={`✗ ${formatGateLabel(g)}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
          <span>{expanded ? "Hide" : "Details"}</span>
          {expanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/30 space-y-2.5">
          {passed.length > 0 && (
            <div>
              <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Gates Passed (
                {passed.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {passed.map((g) => (
                  <div key={g} className="flex items-start gap-1.5 text-[10px]">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-foreground font-medium">
                        {formatGateLabel(g)}
                      </p>
                      <p className="text-muted-foreground/70 leading-tight">
                        {getGateDescription(g)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {failed.length > 0 && (
            <div>
              <p className="text-[10px] text-red-400 uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Gates Failed ({failed.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {failed.map((g) => (
                  <div key={g} className="flex items-start gap-1.5 text-[10px]">
                    <XCircle className="w-3 h-3 text-red-400/70 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-foreground/80 font-medium">
                        {formatGateLabel(g)}
                      </p>
                      <p className="text-muted-foreground/70 leading-tight">
                        {getGateDescription(g)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tier ladder + mandatory/optional split (B2) ───────────────────────────────

function GateChip({ gate, on }: { gate: string; on: boolean }) {
  // D2 — tiap nama gate menautkan ke kartunya di /belajar: definisi, cara
  // dihitung, dan lift terukurnya lengkap dengan CI dan vonis.
  return (
    <Link
      href={`/belajar#${gate}`}
      title={`${getGateDescription(gate)} — klik untuk pelajari`}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition-colors",
        on
          ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/15"
          : "text-muted-foreground border-border bg-secondary/40 hover:bg-secondary",
      )}
    >
      {on ? (
        <CheckCircle2 className="w-2.5 h-2.5" />
      ) : (
        <XCircle className="w-2.5 h-2.5 opacity-50" />
      )}
      {formatGateLabel(gate)}
    </Link>
  );
}

/**
 * D1 — "Kenapa sinyal ini muncul?"
 *
 * Narasi terstruktur dari data yang SUDAH ada (`gates_all` + tier spec) —
 * bukan lapisan LLM. Angkanya sudah presisi; menambah lapisan generatif hanya
 * menambah permukaan halusinasi tanpa manfaat terukur.
 */
function WhyThisSignal({
  signal,
  spec,
}: {
  signal: Signal;
  spec: TierMeta | null | undefined;
}) {
  if (!spec) return null;
  const all = signal.gates_all ?? {};
  const failed = Object.entries(all)
    .filter(([, v]) => v === false)
    .map(([k]) => k);
  const extraOn = Object.entries(all)
    .filter(([k, v]) => v === true && !spec.mandatory.includes(k))
    .map(([k]) => k);

  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-2.5 space-y-1.5">
      <p className="text-[11px] font-semibold flex items-center gap-1.5">
        <Info className="w-3 h-3 text-primary" />
        Kenapa sinyal ini muncul?
      </p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Tier <span className="text-foreground font-medium">{signal.tier}</span>{" "}
        tercapai karena {spec.mandatory.length} gate wajibnya lolos
        {spec.mandatory.length > 0 && (
          <>
            {" ("}
            {spec.mandatory.map((g, i) => (
              <span key={g}>
                {i > 0 && ", "}
                <Link
                  href={`/belajar#${g}`}
                  className="text-primary hover:underline"
                >
                  {formatGateLabel(g)}
                </Link>
              </span>
            ))}
            {")"}
          </>
        )}
        , dan R:R {signal.rr_ratio} memenuhi minimum {spec.min_rr}.
        {extraOn.length > 0 && (
          <> {extraOn.length} gate lain ikut menyala.</>
        )}
        {failed.length > 0 && (
          <>
            {" "}
            Yang tidak lolos:{" "}
            {failed.slice(0, 4).map((g, i) => (
              <span key={g}>
                {i > 0 && ", "}
                <Link
                  href={`/belajar#${g}`}
                  className="text-primary hover:underline"
                >
                  {formatGateLabel(g)}
                </Link>
              </span>
            ))}
            {failed.length > 4 && ` +${failed.length - 4} lagi`}.
          </>
        )}
      </p>
      <p className="text-[10px] text-amber-400/90">
        Gate yang lolos bukan bukti setup ini akan menang — belum satu pun dari
        12 gate terbukti menaikkan winrate.{" "}
        <Link href="/belajar" className="underline hover:text-amber-300">
          Pelajari angkanya
        </Link>
        .
      </p>
    </div>
  );
}

function TierLadderPanel({
  ladder,
  spec,
  knownTrue,
  optionalRecorded,
}: {
  ladder: TierLadder | null;
  spec: TierMeta;
  knownTrue: string[];
  optionalRecorded: boolean;
}) {
  const known = new Set(knownTrue);
  const optHave = spec.optional.filter((g) => known.has(g)).length;

  return (
    <div className="rounded-lg border border-border bg-secondary/30 mb-3 overflow-hidden">
      {/* Ladder — kenapa tier ini, bukan yang di atas */}
      {ladder && (
        <div
          className={cn(
            "px-3 py-2 text-[11px] border-b border-border/30",
            ladder.nextTier === null
              ? "text-emerald-400"
              : ladder.nearly && optionalRecorded
                ? "text-amber-300"
                : "text-muted-foreground",
          )}
        >
          {ladder.nextTier === null ? (
            <span className="font-semibold">🎯 Tier tertinggi tercapai</span>
          ) : !optionalRecorded ? (
            <span>
              <span className="font-semibold text-foreground">
                {ladder.currentTier}
              </span>{" "}
              → {ladder.nextTier}: butuh gate tambahan{" "}
              <span className="text-muted-foreground/60">
                (detail optional tak tercatat untuk sinyal lama)
              </span>
            </span>
          ) : (
            <span>
              <span className="font-semibold text-foreground">
                {ladder.currentTier}
              </span>{" "}
              → <span className="font-semibold">{ladder.nextTier}</span>:{" "}
              {ladder.nearly && <span className="font-semibold">nyaris — </span>}
              kurang{" "}
              {ladder.missingMandatory.length > 0 &&
                ladder.missingMandatory.map(formatGateLabel).join(", ")}
              {ladder.optionalShort > 0 &&
                `${ladder.missingMandatory.length ? " · " : ""}${ladder.optionalShort} gate optional`}
              {ladder.rrNeeded !== null && ` · R:R ≥ ${ladder.rrNeeded}`}
            </span>
          )}
        </div>
      )}

      {/* Pisah wajib vs optional untuk tier tercapai */}
      <div className="px-3 py-2 space-y-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-1 text-muted-foreground">
            Wajib
          </p>
          <div className="flex flex-wrap gap-1">
            {spec.mandatory.map((g) => (
              <GateChip key={g} gate={g} on={known.has(g)} />
            ))}
          </div>
        </div>
        {spec.optional.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-1 text-muted-foreground">
              {/* Penyebutnya BERAPA YANG ADA, bukan berapa yang diwajibkan.
                  Sebelum 30 Agu 2026 tertulis `{optHave}/{spec.min_opt}`, dan
                  itu salah dua arah sekaligus:
                    • RADAR (min_opt=0) tampil "Optional (0/0)" tepat di atas
                      DUA chip gate — kartunya membantah dirinya sendiri, dan
                      terbaca "tidak ada gate optional" padahal ada dua yang
                      gagal;
                    • kalau yang lolos melebihi minimumnya (mis. STANDARD punya
                      4 optional, min_opt=2, tiga lolos) ia mencetak
                      "Optional (3/2)" — pecahan yang lebih besar dari satu.
                  Minimumnya tetap disebut, terpisah, karena itu memang
                  besaran yang berbeda. */}
              Optional ({optHave}/{spec.optional.length} lolos · minimal{" "}
              {spec.min_opt})
              {!optionalRecorded && (
                <span className="ml-1 normal-case font-normal text-muted-foreground/60">
                  · tak tercatat untuk sinyal lama
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-1">
              {spec.optional.map((g) => (
                <GateChip key={g} gate={g} on={known.has(g)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Signal Reason Component ───────────────────────────────────────────────────

function SignalReason({ reason }: { reason: string }) {
  if (!reason || reason.trim() === "") return null;

  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 mb-3">
      <div className="flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold mb-0.5">
            Signal Reason
          </p>
          <p className="text-xs text-foreground/90 leading-relaxed">{reason}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * D5 — "kapan sinyal ini batal?", dinyatakan di muka.
 *
 * Kenapa ini ada di kartu, bukan di halaman terpisah: syarat batal yang baru
 * dibaca setelah posisi merugi bukan syarat batal, melainkan pembenaran. Yang
 * ditampilkan datang dari `signal_lifecycle` — modul yang sama yang kelak
 * memvonis sinyal ini, jadi apa yang dijanjikan di sini adalah apa yang akan
 * dinilai.
 */
function InvalidationPanel({
  invalidation,
}: {
  invalidation?: Signal["invalidation"];
}) {
  const [open, setOpen] = useState(false);
  if (!invalidation?.syarat?.length) return null;

  const sebelum = invalidation.syarat.filter((s) => s.kapan === "sebelum entry");
  const sesudah = invalidation.syarat.filter((s) => s.kapan !== "sebelum entry");

  return (
    <div className="mb-3 rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
      >
        <span className="text-[11px] font-semibold">Kapan sinyal ini batal?</span>
        <span className="text-[10px] text-muted-foreground">
          {open ? "tutup" : "lihat"}
        </span>
      </button>

      <p className="px-3 pb-2 text-[10px] leading-relaxed text-muted-foreground">
        {invalidation.ringkas}
      </p>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
          {[
            { judul: "Sebelum entry", isi: sebelum },
            { judul: "Setelah entry", isi: sesudah },
          ].map(
            (blok) =>
              blok.isi.length > 0 && (
                <div key={blok.judul}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {blok.judul}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {blok.isi.map((s) => (
                      <li
                        key={s.kode}
                        className="text-[10px] leading-relaxed text-foreground/90 pl-3 border-l border-border"
                      >
                        {s.kalimat.replace(/\*\*/g, "")}
                      </li>
                    ))}
                  </ul>
                </div>
              ),
          )}
          <p className="text-[10px] text-muted-foreground/60 pt-1">
            Syarat ini dihitung dari aturan siklus hidup yang berlaku sekarang —
            modul yang sama yang akan memvonis sinyal ini.
          </p>
        </div>
      )}
    </div>
  );
}

// ── B3 — Checklist verifikasi 1-tap yang menggerbangi tombol record ───────────

function ChecklistItem({
  checked,
  onToggle,
  label,
  extra,
}: {
  checked: boolean;
  onToggle: () => void;
  label: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="text-[11px]">
      <div
        onClick={onToggle}
        className="flex items-start gap-2 cursor-pointer select-none"
      >
        <span
          className={cn(
            "w-3.5 h-3.5 rounded border shrink-0 mt-0.5 flex items-center justify-center",
            checked
              ? "bg-emerald-500/20 border-emerald-500/50"
              : "border-border",
          )}
        >
          {checked && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
        </span>
        <span className="text-foreground/90">{label}</span>
      </div>
      {extra && <div className="ml-6 mt-1">{extra}</div>}
    </div>
  );
}

function RecordChecklist({
  signal,
  onTrade,
  newsPassed,
}: {
  signal: Signal;
  onTrade: (s: Signal) => void;
  newsPassed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [chartChecked, setChartChecked] = useState(false);
  const [corrChecked, setCorrChecked] = useState(false);
  const [rrChecked, setRrChecked] = useState(false);
  const [openTrades, setOpenTrades] = useState<Trade[] | null>(null);
  // C1 — proyeksi risiko portofolio untuk sinyal INI. `undefined` = belum
  // dimuat, `null` = gagal dimuat (dan itu dibedakan: kalau tak bisa dicek,
  // item korelasi kembali jadi centang manual, bukan diam-diam dianggap aman).
  const [risk, setRisk] = useState<PortfolioRisk | null | undefined>(undefined);

  // Fetch posisi terbuka + proyeksi risiko lazy — hanya saat checklist dibuka.
  useEffect(() => {
    if (!open || openTrades !== null) return;
    let alive = true;
    api.trades
      .list()
      .then(
        (all) =>
          alive && setOpenTrades(all.filter((t) => t.outcome === "open")),
      )
      .catch(() => alive && setOpenTrades([]));
    api
      .portfolioRisk(signal.id)
      .then((r) => alive && setRisk(r))
      .catch(() => alive && setRisk(null));
    return () => {
      alive = false;
    };
  }, [open, openTrades, signal.id]);

  const corrBlockers = risk?.projection?.correlation_groups?.filter(
    (g) => g.over_group_budget,
  );
  const corrBlocked = !!corrBlockers?.length;
  const corrGroups = risk?.projection?.correlation_groups ?? [];

  const label =
    signal.tier === "RADAR"
      ? "Track Observation"
      : signal.tier === "SCOUT"
        ? "Record (Small Size)"
        : "Record Trade";

  const btnStyle =
    signal.tier === "RADAR"
      ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/25 hover:bg-yellow-500/20 hover:border-yellow-500/40"
      : signal.tier === "SCOUT"
        ? "bg-blue-500/10 text-blue-400 border-blue-500/25 hover:bg-blue-500/20 hover:border-blue-500/40"
        : "bg-primary/15 text-primary border-primary/25 hover:bg-primary/25 hover:border-primary/40";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "w-full py-2 rounded-lg text-sm font-medium border transition-all active:scale-[0.98]",
          btnStyle,
        )}
      >
        {label}
      </button>
    );
  }

  // Blocker korelasi mengunci tombol tanpa bisa dicentang manual — itu bedanya
  // dengan tiga item lain. Kalau ceknya gagal (`risk === null`), item korelasi
  // kembali jadi centang manual supaya kegagalan jaringan tidak memblokir
  // pencatatan.
  const allChecked =
    chartChecked && rrChecked && (corrBlocked ? false : corrChecked);

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2.5">
      <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5 text-primary" /> Verifikasi sebelum
        eksekusi
      </p>

      {/* 1. Chart & overlay (manual, nyambung ke B1) */}
      <ChecklistItem
        checked={chartChecked}
        onToggle={() => setChartChecked((v) => !v)}
        label="Chart & overlay dicek — setup masih cocok"
        extra={
          <Link
            href={`/market/${signal.market}/${signal.ticker}`}
            className="text-primary hover:underline"
          >
            buka chart →
          </Link>
        }
      />

      {/* 2. News (otomatis) */}
      <div className="flex items-start gap-2 text-[11px]">
        {newsPassed ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
        )}
        <span className={newsPassed ? "text-muted-foreground" : "text-red-400"}>
          News clear (otomatis)
          {newsPassed ? "" : " — ADA news high-impact!"}
        </span>
      </div>

      {/* 3. Korelasi (C1) — otomatis dari grup korelasi, bukan lagi dinilai
          manual. Kalau sinyal ini menumpuk searah pada grup yang sudah penuh,
          tombol record TERKUNCI: lima taruhan berkorelasi adalah satu taruhan
          besar, dan modal Rp3jt tidak punya ruang untuk itu. */}
      {corrBlocked ? (
        <div className="flex items-start gap-2 text-[11px]">
          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <span className="text-red-400">
            Korelasi — TERKUNCI (otomatis)
            {corrBlockers!.map((g) => (
              <span key={g.group} className="block text-[10px] mt-0.5">
                {g.label}: sudah ada {g.existing_tickers.join(", ")} searah.
                Menambah ini jadi Rp{Math.round(g.risk_idr_after).toLocaleString("id-ID")} —
                lewat batas per grup.
              </span>
            ))}
          </span>
        </div>
      ) : (
        <ChecklistItem
          checked={corrChecked}
          onToggle={() => setCorrChecked((v) => !v)}
          label="Korelasi — tidak menumpuk aset/sektor sama"
          extra={
            <span className="text-[10px] text-muted-foreground">
              {risk === undefined
                ? "Memeriksa grup korelasi…"
                : risk === null
                  ? "Cek korelasi gagal — nilai sendiri dari posisi terbuka."
                  : corrGroups.length > 0
                    ? `Searah di ${corrGroups
                        .map((g) => `${g.label} (${g.existing_tickers.join(", ")})`)
                        .join("; ")} — masih di bawah batas.`
                    : openTrades === null
                      ? "Memuat posisi terbuka…"
                      : openTrades.length === 0
                        ? "Tak ada posisi terbuka."
                        : `Tidak berkorelasi dengan ${openTrades.map((t) => t.ticker).join(", ")}.`}
            </span>
          }
        />
      )}

      {/* 4. R:R & lot */}
      <ChecklistItem
        checked={rrChecked}
        onToggle={() => setRrChecked((v) => !v)}
        label={`R:R & lot masuk akal untuk modal Rp3jt (R:R 1:${signal.rr_ratio})`}
      />

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => setOpen(false)}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:bg-secondary transition-all"
        >
          Batal
        </button>
        <button
          disabled={!allChecked}
          onClick={() => onTrade(signal)}
          className={cn(
            "flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all",
            allChecked
              ? btnStyle
              : "bg-secondary/50 text-muted-foreground/50 border-border cursor-not-allowed",
          )}
        >
          Konfirmasi {label}
        </button>
      </div>
    </div>
  );
}

// ── Main SignalCard ───────────────────────────────────────────────────────────

export default function SignalCard({ signal, onTrade }: Props) {
  const tier = TIER_CONFIG[signal.tier];
  const market = MARKET_CONFIG[signal.market];
  const isLong = signal.direction === "LONG";

  // Umur sinyal. `GET /signals` mengembalikan N baris terakhir TANPA batas
  // umur, jadi sinyal Mei bisa duduk bersebelahan dengan sinyal hari ini dan
  // — sampai 26 Agustus 2026 — tampil persis sama. Kartu yang tidak
  // menyebutkan umurnya membuat "scan barusan menemukan ini" dan "ini sisa
  // tiga bulan lalu" tidak bisa dibedakan.
  const stale = signal.created_at ? isStale(signal.created_at) : false;

  // B2 — tier specs (fetch sekali, dibagi via cache) untuk tier ladder.
  const [tiers, setTiers] = useState<TierMeta[] | null>(null);
  useEffect(() => {
    let alive = true;
    getTierSpecs()
      .then((r) => alive && setTiers(r.tiers))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const optionalRecorded = Array.isArray(signal.optional_passed);
  const knownTrue = [
    ...(Array.isArray(signal.gates_passed) ? signal.gates_passed : []),
    ...(optionalRecorded ? (signal.optional_passed as string[]) : []),
  ];
  const ladder = tiers
    ? computeTierLadder(signal.tier, knownTrue, signal.rr_ratio, tiers)
    : null;
  const spec = tiers ? tierSpec(signal.tier, tiers) : undefined;

  // News = absolute-mandatory, jadi selalu lolos untuk sinyal yang tampil;
  // tandai merah hanya kalau eksplisit ada di gates_failed (defensif).
  const newsPassed = !(
    Array.isArray(signal.gates_failed) ? signal.gates_failed : []
  ).includes("no_high_impact_news");

  // Tier-specific guidance for Record Trade
  const tierGuidance: Record<
    string,
    { canRecord: boolean; warning?: string; noteSuggestion?: string }
  > = {
    SNIPER: { canRecord: true },
    PRECISION: { canRecord: true },
    STANDARD: {
      canRecord: true,
      warning: "Setup standard — pertimbangkan size lebih kecil",
    },
    SCOUT: {
      canRecord: true,
      warning: "Setup awal — risk maksimal 1% modal",
      noteSuggestion: "Scout: ukuran kecil untuk testing setup",
    },
    RADAR: {
      canRecord: true,
      warning: "Hanya watchlist — record untuk tracking observasi",
      noteSuggestion: "Radar: tracking only, paper trade atau ukuran minimal",
    },
  };

  const guidance = tierGuidance[signal.tier] ?? { canRecord: true };

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-card p-4 transition-all duration-300",
        "hover:border-border/80 hover:shadow-lg",
        signal.tier === "SNIPER"
          ? "border-emerald-400/30 shadow-[0_0_20px_rgba(52,211,153,0.05)]"
          : "border-border",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-2 py-0.5 rounded-md text-xs font-semibold border",
              tier.bgColor,
            )}
          >
            {tier.emoji} {tier.label}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {market?.emoji} {signal.submarket}
          </span>
        </div>

        {/* Badge = `evidence_pct`, BUKAN `confidence`.
            Sejak 29 Agu 2026 backend memisahkan dua besaran yang dulu ditumpuk
            di satu angka: `confidence` kini perkiraan peluang menang
            terkalibrasi, dan karena belum ada kombinasi gate yang terbukti
            punya daya pisah, nilainya SAMA untuk semua sinyal di satu pasar —
            memakainya di sini berarti menampilkan angka yang identik di setiap
            kartu. `evidence_pct` (berapa banyak bukti opsional yang lolos)
            adalah satu-satunya yang bervariasi. */}
        {typeof signal.evidence_pct === "number" ? (
          <div
            className="flex items-center gap-1.5"
            title={
              `Bukti opsional yang lolos di tier ${signal.tier}: ` +
              `${signal.evidence_pct}%. Ini BUKAN peluang menang — belum ada ` +
              `kombinasi gate yang terbukti memprediksi kemenangan. ` +
              `Penyebutnya berbeda per tier, jadi angka ini tidak sebanding ` +
              `antar-kartu dengan tier berbeda.`
            }
          >
            {/* Warna lampu-lalu-lintas DICABUT 30 Agu 2026, bukan disetel ulang.
                Hijau/biru/kuning menyatakan "makin banyak bukti makin baik" —
                justru hubungan yang DIBANTAH pengukuran. Harness crypto,
                8.950 trade:

                  RADAR    0/2  n=4920  36,8 %   <- bukti lebih SEDIKIT,
                  RADAR    1/2  n=1496  35,0 %      winrate lebih TINGGI
                  SCOUT    1/3  n=1856  37,7 %
                  SCOUT    2/3  n= 647  40,0 %
                  STANDARD 2/4  n=  25  32,0 %

                Tidak monoton, CI bertumpang tindih di mana-mana.

                Alasan kedua, berdiri sendiri: PENYEBUTNYA berbeda per tier dan
                per pasar (di crypto SNIPER cuma punya 1 gate optional karena
                `kill_zone` tidak dikirim, STANDARD punya 4). "100 %" karena
                itu tidak berarti sama di dua kartu, sehingga ambang warna
                lintas tier membandingkan yang tidak sebanding — cacat yang
                sama yang membuat `confidence` tidak jujur.

                Barnya tetap ada: proporsi itu sendiri informatif. Yang dicabut
                cuma penilaian bagus/buruknya. */}
            <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-muted-foreground/60"
                style={{ width: `${signal.evidence_pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {signal.evidence_pct}% bukti
            </span>
          </div>
        ) : (
          /* Sinyal pra-29-Agu-2026. `confidence` lamanya BUKAN besaran yang
             sama (ia memuat blok mandatory di pembilang dan penyebut), jadi
             menampilkannya di slot ini akan membandingkan dua penggaris. */
          <span
            className="text-xs text-muted-foreground/60 font-mono"
            title="Sinyal dibuat sebelum 29 Agu 2026 — bukti opsional belum dicatat terpisah."
          >
            bukti n/a
          </span>
        )}
      </div>

      {/* Ticker + Direction */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground tracking-tight">
            {signal.display}
          </h3>
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium mt-0.5",
              isLong ? "text-profit" : "text-loss",
            )}
          >
            {isLong ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {signal.direction}
          </div>
          {signal.created_at && (
            <div
              className={cn(
                "flex items-center gap-1 text-[11px] mt-1",
                stale ? "text-amber-500" : "text-muted-foreground",
              )}
              title={new Date(signal.created_at).toLocaleString("id-ID")}
            >
              <Clock className="w-3 h-3 shrink-0" />
              {timeAgo(signal.created_at)}
              {stale && (
                <span className="font-medium">
                  · lewat jendela {STALE_AFTER_DAYS} hari
                </span>
              )}
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="text-lg font-bold text-foreground font-mono">
            1:{signal.rr_ratio}
          </div>
          <div className="text-xs text-muted-foreground">R:R ratio</div>
        </div>
      </div>

      {/* Price levels */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <PriceLevel
          label="Entry"
          price={formatPrice(signal.entry, signal.market)}
          color="text-foreground"
        />
        <PriceLevel
          label="Stop Loss"
          price={formatPrice(signal.stop_loss, signal.market)}
          color="text-loss"
          icon={<Shield className="w-3 h-3" />}
        />
        <PriceLevel
          label="Take Profit"
          price={formatPrice(signal.take_profit, signal.market)}
          color="text-profit"
          icon={<Target className="w-3 h-3" />}
        />
      </div>

      {/* Position sizing */}
      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50 mb-3">
        <div className="text-xs">
          <span className="text-muted-foreground">Risk </span>
          <span className="text-loss font-medium font-mono">
            {formatIDR(signal.risk_idr)}
          </span>
        </div>
        <div className="w-px h-3 bg-border" />
        <div className="text-xs">
          <span className="text-muted-foreground">Target </span>
          <span className="text-profit font-medium font-mono">
            {formatIDR(signal.risk_idr * signal.rr_ratio)}
          </span>
        </div>
        <div className="w-px h-3 bg-border" />
        <div className="text-xs">
          <span className="text-muted-foreground">Position </span>
          <span className="text-foreground font-medium font-mono">
            {formatIDR(signal.position_idr)}
          </span>
        </div>
      </div>

      {/* Wyckoff */}
      {signal.wyckoff && signal.wyckoff !== "UNKNOWN" && (
        <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
          <AlertTriangle className="w-3 h-3 text-warning" />
          <span>
            Wyckoff Phase{" "}
            <span className="text-warning font-medium">{signal.wyckoff}</span>
          </span>
        </div>
      )}

      {/* ✨ NEW: Signal Reason */}
      <SignalReason reason={signal.reason ?? ""} />

      {/* D1 — panel "kenapa sinyal ini muncul?" */}
      <WhyThisSignal signal={signal} spec={spec} />

      {/* D5 — kapan sinyal ini batal, dinyatakan SEBELUM apa pun terjadi */}
      <InvalidationPanel invalidation={signal.invalidation} />

      {/* B2 — panel keputusan: tier ladder + wajib/optional split */}
      {spec ? (
        <TierLadderPanel
          ladder={ladder}
          spec={spec}
          knownTrue={knownTrue}
          optionalRecorded={optionalRecorded}
        />
      ) : (
        <GatesDetail
          passed={Array.isArray(signal.gates_passed) ? signal.gates_passed : []}
          failed={Array.isArray(signal.gates_failed) ? signal.gates_failed : []}
        />
      )}

      {/* Sentiment flag */}
      {signal.sentiment && (
        <SentimentFlag sentiment={signal.sentiment as SentimentData} />
      )}

      {/* ✨ UPDATED: Tier-specific warning untuk RADAR/SCOUT */}
      {guidance.warning && (
        <div
          className={cn(
            "flex items-start gap-2 px-3 py-2 mb-3 rounded-lg border text-[10px]",
            signal.tier === "RADAR"
              ? "border-yellow-500/20 bg-yellow-500/5 text-yellow-300"
              : signal.tier === "SCOUT"
                ? "border-blue-500/20 bg-blue-500/5 text-blue-300"
                : "border-orange-500/20 bg-orange-500/5 text-orange-300",
          )}
        >
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>{guidance.warning}</span>
        </div>
      )}

      {/* B3 — checklist verifikasi 1-tap menggerbangi record (semua tier) */}
      {onTrade && guidance.canRecord && (
        <RecordChecklist
          signal={signal}
          onTrade={onTrade}
          newsPassed={newsPassed}
        />
      )}
    </div>
  );
}

function PriceLevel({
  label,
  price,
  color,
  icon,
}: {
  label: string;
  price: string;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-secondary/50 p-2 text-center">
      <div
        className={cn(
          "flex items-center justify-center gap-1 text-xs font-medium font-mono",
          color,
        )}
      >
        {icon}
        {price}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
