"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useRuntime } from "@/lib/runtime";
import MetricGlossary from "@/components/system/MetricGlossary";
import { ApiErrorNotice } from "@/components/system/StateNotice";
import type { BackendRuntime, RuntimeReport } from "@/types/runtime";
import { TIER_CONFIG } from "@/types";
import type {
  GateLiftRow,
  GateVerdict,
  ReliabilityBucket,
  ReportCard,
  SampleSummary,
  TierHitRate,
} from "@/types";
import type { ContractInfo, ContractParam } from "@/types/contract";

const MARKETS = ["all", "stock", "stock_idx", "stock_us", "crypto", "forex"];

const VERDICT_STYLE: Record<GateVerdict, string> = {
  positif: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  negatif: "bg-destructive/10 text-destructive border-destructive/20",
  "tidak konklusif": "bg-secondary text-muted-foreground border-border",
  // "sampel kurang" = data tambahan menolong. Empat di bawahnya = tidak.
  // Warnanya sengaja berbeda supaya keduanya tidak terbaca sebagai hal sama.
  "sampel kurang": "bg-secondary/50 text-muted-foreground border-border",
  "tak ada di vektor": "bg-violet-400/10 text-violet-400 border-violet-400/20",
  "tak terukur (konstan)": "bg-violet-400/10 text-violet-400 border-violet-400/20",
  "tak terukur (tersaring tier)":
    "bg-violet-400/10 text-violet-400 border-violet-400/20",
  "tak terukur (satu nilai)":
    "bg-violet-400/10 text-violet-400 border-violet-400/20",
};

const VERDICT_FALLBACK = "bg-secondary/50 text-muted-foreground border-border";

function pct(v: number | null | undefined, suffix = "%"): string {
  return v == null ? "—" : `${v}${suffix}`;
}

function CI({ row }: { row: { ci_low: number | null; ci_high: number | null } }) {
  if (row.ci_low == null || row.ci_high == null) return <span>—</span>;
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {row.ci_low}–{row.ci_high}%
    </span>
  );
}

/** Sampel kecil ditandai eksplisit — bukan disembunyikan di balik angka bulat. */
function SampleBadge({ sample }: { sample: SampleSummary }) {
  if (sample.decided === 0) return null;
  if (sample.enough_sample) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
      n={sample.decided} · indikatif
    </span>
  );
}

export default function ReportCardContent() {
  const [market, setMarket] = useState("all");
  const [contract, setContract] = useState<ContractParam>("active");
  const [data, setData] = useState<(ReportCard & { contract?: ContractInfo }) | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const backend = useRuntime().report?.backend;
  const runtime = backend?.runtime ?? null;
  const tierContract = backend?.contract ?? null;

  useEffect(() => {
    let cancelled = false;
    // setState hanya di dalam callback promise — bukan sinkron di badan effect.
    api.analytics
      .reportCard(market, contract)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [market, contract, attempt]);

  if (loading && !data)
    return <p className="text-sm text-muted-foreground">Memuat…</p>;
  if (error)
    return (
      <ApiErrorNotice
        error={error}
        action="memuat report card"
        onRetry={() => {
          setLoading(true);
          setAttempt((n) => n + 1);
        }}
      />
    );
  if (!data) return null;

  const { overall } = data;
  const info = data.contract;

  return (
    <div className="flex flex-col gap-6">
      {/* Filter market */}
      <div className="flex flex-wrap gap-1.5">
        {MARKETS.map((m) => (
          <button
            key={m}
            onClick={() => {
              if (m === market) return;
              setLoading(true);
              setMarket(m);
            }}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium border transition-all",
              market === m
                ? "bg-primary/10 text-primary border-primary/20"
                : "border-border text-muted-foreground hover:bg-secondary",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {info && (
        <ContractBanner
          info={info}
          current={contract}
          onPick={(c) => {
            if (c === contract) return;
            setLoading(true);
            setContract(c);
          }}
        />
      )}

      {/* Pernyataan kepercayaan — bagian terpenting halaman ini */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {data.trust_statement}
            </p>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <Stat label="Teresolusi" value={String(overall.decided)} />
              <Stat
                label="Win rate"
                value={pct(overall.win_rate)}
                sub={<CI row={overall} />}
              />
              <Stat
                label="Expectancy"
                value={overall.expectancy_r == null ? "—" : `${overall.expectancy_r}R`}
              />
              <Stat
                label="Calibration error"
                value={pct(data.calibration_error_pp, " pp")}
              />
            </div>
          </div>
        </div>
      </div>

      <ReadingGuide runtime={runtime} contract={tierContract} />

      <EmptyNotice decided={overall.decided} info={info} />

      <ReliabilitySection
        curve={data.reliability}
        errorPp={data.calibration_error_pp}
        contract={tierContract}
        selected={info?.selected ?? null}
      />
      <TierSection rows={data.by_tier} />
      <GateLiftSection rows={data.gate_lift} />
      <BacktestSection
        runs={data.backtest_runs}
        ditolak={data.backtest_runs_ditolak ?? []}
      />
    </div>
  );
}

function contractLabel(hash: string): string {
  return hash === "none" ? "tanpa hash (pra-28 Agu)" : hash;
}

/** Kotak "belum ada data" yang membedakan dua sebab kosong. */
export function EmptyNotice({
  decided,
  info,
}: {
  decided: number;
  info?: ContractInfo;
}) {
  if (decided > 0) return null;
  // Kosong karena PILIHAN kontrak, bukan karena sistem belum pernah
  // menghasilkan apa pun — dua keadaan yang tindak lanjutnya berbeda.
  const karenaKontrak = info != null && info.excluded > 0;
  return (
    <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm">
      <p className="flex items-start gap-2 text-yellow-400">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        {karenaKontrak ? (
          <span>
            Kontrak <span className="font-mono">{contractLabel(info.selected)}</span>{" "}
            belum punya sinyal teresolusi. {info.excluded} baris dari kontrak
            lain sengaja tidak dihitung: nama tier sama, populasi berbeda. Lihat
            kontrak lain secara terpisah lewat pilihan di atas — jangan dipakai
            untuk menilai kontrak ini.
          </span>
        ) : (
          <span>
            Belum ada sinyal live yang teresolusi. Menunggu akumulasi sinyal
            butuh berbulan-bulan — jalankan harness backtest untuk mendapat
            angka hari ini:
            <code className="ml-1 px-1.5 py-0.5 rounded bg-background/60 font-mono text-xs">
              python -m core.backtest_harness --market stock_idx --mode both
            </code>
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * Kontrak tier di balik setiap angka halaman ini. Backend memilih SATU
 * kontrak secara bawaan (kode yang sedang berjalan) dan menghitung apa yang ia
 * keluarkan; "gabung semua" tersedia, tetapi dengan peringatannya.
 */
export function ContractBanner({
  info,
  current,
  onPick,
}: {
  info: ContractInfo;
  current: ContractParam;
  onPick: (c: ContractParam) => void;
}) {
  const lain = Object.keys(info.counts).filter((h) => h !== info.active);
  const pilihan: { value: ContractParam; label: string }[] = [
    { value: "active", label: `aktif · ${info.active}` },
    ...lain.map((h) => ({ value: h, label: contractLabel(h) })),
    { value: "all", label: "gabung semua" },
  ];
  const hitungan = Object.entries(info.counts);
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm">
      <p className="text-foreground">
        Kontrak tier:{" "}
        <span className="font-mono">
          {info.selected === "all" ? "semua digabung" : contractLabel(info.selected)}
        </span>
        {info.selected === info.active && (
          <span className="ml-1.5 text-xs text-muted-foreground">
            (kode yang sedang berjalan)
          </span>
        )}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {hitungan.length === 0
          ? "Belum ada baris berlabel di kontrak mana pun."
          : "Baris per kontrak: " +
            hitungan.map(([h, n]) => `${contractLabel(h)} ${n}`).join(" · ")}
        {info.excluded > 0 && ` — ${info.excluded} tidak ikut angka di bawah.`}
      </p>
      {info.warning && (
        <p className="mt-2 flex items-start gap-2 text-xs text-yellow-400">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{info.warning}</span>
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {pilihan.map((p) => (
          <button
            key={p.value}
            onClick={() => onPick(p.value)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-mono border transition-all",
              current === p.value
                ? "bg-primary/10 text-primary border-primary/20"
                : "border-border text-muted-foreground hover:bg-secondary",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {sub}
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </div>
      <div className="p-4 overflow-x-auto">{children}</div>
    </section>
  );
}

/**
 * Batas tafsir halaman ini. Angka di sini DESKRIPTIF: report card tidak
 * mengeluarkan vonis edge, dan win rate/CI-nya punya asumsi yang perlu
 * disebut di tempat angka itu dibaca, bukan hanya di dokumen riset.
 */
export function ReadingGuide({
  runtime,
  contract = null,
}: {
  runtime: BackendRuntime | null;
  contract?: RuntimeReport["backend"]["contract"];
}) {
  return (
    <details className="rounded-lg border border-border bg-card p-4 text-sm" data-testid="reading-guide">
      <summary className="cursor-pointer font-medium text-foreground">
        Cara membaca angka di halaman ini
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          deskriptif · bukan vonis edge · {runtime ? `mode ${runtime.mode.toUpperCase()}` : "mode belum diketahui"}
        </span>
      </summary>
      <MetricGlossary
        className="mt-3"
        runtime={runtime}
        contract={contract}
        only={["winrate", "ci", "expectancy", "forward", "confidence", "tier", "paper"]}
      />
    </details>
  );
}

/** Confidence yang dilaporkan vs winrate yang benar-benar terjadi. */
function ReliabilitySection({
  curve,
  errorPp,
  contract,
  selected,
}: {
  curve: ReliabilityBucket[];
  errorPp: number | null;
  contract: RuntimeReport["backend"]["contract"];
  selected: string | null;
}) {
  // Kalibrasi berlaku PER KONTRAK. Klaim lama "confidence terkalibrasi (ECE
  // 15,11 → 1,9 pp)" berasal dari kontrak AND 29 Agu dan salah untuk
  // weighted-v1, yang backend-nya sendiri menyatakan belum dikalibrasi.
  const forActive = contract && selected === contract.spec_hash;
  const calibrationText = !contract
    ? "Status kalibrasi confidence tidak diketahui (backend belum menjawab); anggap belum dikalibrasi."
    : forActive
      ? contract.confidence_calibrated
        ? `Backend menyatakan confidence kontrak ${contract.policy} · ${contract.spec_hash} terkalibrasi.`
        : `Confidence untuk kontrak ${contract.policy} · ${contract.spec_hash} BELUM dikalibrasi — tabel ini mengukur seberapa jauh angkanya meleset, bukan membuktikan kalibrasi.`
      : `Kontrak yang dipilih (${selected ?? "?"}) bukan kontrak aktif; status kalibrasinya tidak dilaporkan backend.`;
  return (
    <Section
      title="Reliability — confidence vs kenyataan"
      hint={
        calibrationText +
        " Confidence bukan skor weighted-v1 dan bukan peluang menang yang bisa dipakai mengurutkan sinyal." +
        (errorPp != null ? ` Rata-rata meleset ${errorPp} pp.` : "")
      }
    >
      {curve.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada data.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="text-left">
              <th className="pb-2 font-medium">Confidence</th>
              <th className="pb-2 font-medium">n</th>
              <th className="pb-2 font-medium">Win rate aktual</th>
              <th className="pb-2 font-medium">CI</th>
              <th className="pb-2 font-medium">Gap</th>
            </tr>
          </thead>
          <tbody>
            {curve.map((b) => (
              <tr key={b.bucket} className="border-t border-border">
                <td className="py-2 font-mono text-xs">{b.bucket}%</td>
                <td className="py-2 tabular-nums">{b.n}</td>
                <td className="py-2 tabular-nums">{pct(b.win_rate)}</td>
                <td className="py-2">
                  <CI row={b} />
                </td>
                <td
                  className={cn(
                    "py-2 tabular-nums font-medium",
                    b.gap_pp == null
                      ? "text-muted-foreground"
                      : b.gap_pp < -10
                        ? "text-destructive"
                        : b.gap_pp > 10
                          ? "text-emerald-400"
                          : "text-muted-foreground",
                  )}
                >
                  {b.gap_pp == null ? "—" : `${b.gap_pp > 0 ? "+" : ""}${b.gap_pp} pp`}
                  {!b.enough_sample && b.n > 0 && (
                    <span className="ml-1.5 text-[10px] text-yellow-400">indikatif</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

    </Section>
  );
}

function TierSection({ rows }: { rows: TierHitRate[] }) {
  const withData = rows.filter((r) => r.total > 0);
  return (
    <Section
      title="Hit rate per tier"
      hint="Tier adalah label ambang skor konfluensi, bukan peringkat kualitas. CI Wilson 95% menganggap sinyal independen; sinyal sehari saling berkorelasi, jadi ketidakpastian nyata lebih lebar. Tier bersampel kecil jangan dibaca sekuat tier bersampel besar."
    >
      {withData.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada sinyal teresolusi di tier mana pun.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="text-left">
              <th className="pb-2 font-medium">Tier</th>
              <th className="pb-2 font-medium">Teresolusi</th>
              <th className="pb-2 font-medium">W / L</th>
              <th className="pb-2 font-medium">Win rate</th>
              <th className="pb-2 font-medium">CI</th>
              <th className="pb-2 font-medium">Expectancy</th>
            </tr>
          </thead>
          <tbody>
            {withData.map((r) => {
              const cfg = TIER_CONFIG[r.tier];
              return (
                <tr key={r.tier} className="border-t border-border">
                  <td className={cn("py-2 font-medium", cfg?.color)}>
                    {cfg?.emoji} {r.tier}
                  </td>
                  <td className="py-2 tabular-nums">
                    {r.decided}{" "}
                    <SampleBadge sample={r} />
                  </td>
                  <td className="py-2 tabular-nums">
                    {r.wins} / {r.losses}
                  </td>
                  <td className="py-2 tabular-nums">{pct(r.win_rate)}</td>
                  <td className="py-2">
                    <CI row={r} />
                  </td>
                  <td className="py-2 tabular-nums">
                    {r.expectancy_r == null ? "—" : `${r.expectancy_r}R`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Section>
  );
}

/** Lift per gate — menjawab "gate mana yang benar-benar sinyal". */
function GateLiftSection({ rows }: { rows: GateLiftRow[] }) {
  const blind = rows.filter((g) => !g.measurable);
  return (
    <Section
      title="Lift per gate"
      hint="Win rate saat gate ON vs OFF. Lift ~0 berarti gate menyaring acak: sinyal berkurang tanpa win rate naik. Lift negatif berarti membuangnya justru menaikkan win rate."
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada vektor gate berlabel. Sinyal sebelum Fase A tidak menyimpannya.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="text-left">
              <th className="pb-2 font-medium">Gate</th>
              <th className="pb-2 font-medium">ON</th>
              <th className="pb-2 font-medium">OFF</th>
              <th className="pb-2 font-medium">Lift</th>
              <th className="pb-2 font-medium">Vonis</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.gate} className="border-t border-border">
                <td className="py-2 font-mono text-xs">{g.gate}</td>
                <td className="py-2 tabular-nums">
                  {pct(g.win_rate_on)}{" "}
                  <span className="text-xs text-muted-foreground">(n={g.n_on})</span>
                </td>
                <td className="py-2 tabular-nums">
                  {pct(g.win_rate_off)}{" "}
                  <span className="text-xs text-muted-foreground">(n={g.n_off})</span>
                </td>
                <td
                  className={cn(
                    "py-2 tabular-nums font-medium",
                    g.lift_pp == null
                      ? "text-muted-foreground"
                      : g.lift_pp > 0
                        ? "text-emerald-400"
                        : g.lift_pp < 0
                          ? "text-destructive"
                          : "text-muted-foreground",
                  )}
                >
                  {g.lift_pp == null
                    ? "—"
                    : `${g.lift_pp > 0 ? "+" : ""}${g.lift_pp} pp`}
                </td>
                <td className="py-2">
                  <span
                    title={g.remedy ?? undefined}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                      VERDICT_STYLE[g.verdict] ?? VERDICT_FALLBACK,
                    )}
                  >
                    {g.verdict}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {blind.length > 0 && (
        // Dipisah dari "sampel kurang" dengan sengaja: untuk gate di bawah ini
        // cabang OFF-nya tidak ada secara konstruksi, jadi menunggu lebih
        // banyak sinyal tidak akan pernah memunculkan angkanya.
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="text-violet-400">{blind.length} gate tak terukur</span> —
          bukan karena sampel kurang: cabang OFF-nya tidak ada secara konstruksi,
          jadi menambah data tidak menolong. Untuk gate yang wajib di tangga tier,
          ukur dengan run khusus:{" "}
          <code className="font-mono text-[11px]">
            python -m core.backtest_harness --measure-gate &lt;nama&gt;
          </code>
        </p>
      )}
    </Section>
  );
}

function BacktestSection({
  runs,
  ditolak,
}: {
  runs: ReportCard["backtest_runs"];
  ditolak: NonNullable<ReportCard["backtest_runs_ditolak"]>;
}) {
  return (
    <Section
      title="Harness backtest tersimpan"
      hint="Sumber angka utama sistem ini. Dijalankan dua kali — 'legacy' sebagai baseline logika lama, 'current' setelah Fase B — supaya perbaikan terbukti, bukan diasumsikan."
    >
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada run tersimpan. Jalankan{" "}
          <code className="px-1.5 py-0.5 rounded bg-secondary font-mono text-xs">
            python -m core.backtest_harness --market stock_idx --mode both --save
          </code>
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="text-left">
              <th className="pb-2 font-medium">Label</th>
              <th className="pb-2 font-medium">Mode</th>
              <th className="pb-2 font-medium">Trade</th>
              <th className="pb-2 font-medium">Win rate</th>
              <th className="pb-2 font-medium">Expectancy</th>
              <th className="pb-2 font-medium">Waktu</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-2 font-mono text-xs">{r.label}</td>
                <td className="py-2">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                      r.mode === "legacy"
                        ? "bg-secondary text-muted-foreground border-border"
                        : "bg-primary/10 text-primary border-primary/20",
                    )}
                  >
                    {r.mode === "legacy" ? "baseline" : r.mode}
                  </span>
                </td>
                <td className="py-2 tabular-nums">{r.trades}</td>
                <td className="py-2 tabular-nums">{pct(r.win_rate)}</td>
                <td className="py-2 tabular-nums">
                  {r.expectancy_r == null ? "—" : `${r.expectancy_r}R`}
                </td>
                <td className="py-2 text-xs text-muted-foreground">
                  {r.created_at?.slice(0, 16).replace("T", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {ditolak.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">
            {ditolak.length} run tersimpan sengaja TIDAK dihitung. Dibawa serta,
            bukan disembunyikan — run yang tidak layak dikutip juga tidak layak
            hilang tanpa jejak.
          </p>
          <ul className="space-y-1">
            {ditolak.map((r) => (
              <li key={r.id} className="text-xs text-muted-foreground">
                <span className="font-mono">{r.label}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}
