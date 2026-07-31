"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TIER_CONFIG } from "@/types";
import type {
  GateLiftRow,
  GateVerdict,
  ReliabilityBucket,
  ReportCard,
  SampleSummary,
  TierHitRate,
} from "@/types";

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
  const [data, setData] = useState<ReportCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // setState hanya di dalam callback promise — bukan sinkron di badan effect.
    api.analytics
      .reportCard(market)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Gagal memuat report card");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [market]);

  if (loading && !data)
    return <p className="text-sm text-muted-foreground">Memuat…</p>;
  if (error)
    return (
      <p className="text-sm text-destructive border border-destructive/20 bg-destructive/10 rounded-md p-3">
        {error}
      </p>
    );
  if (!data) return null;

  const { overall } = data;

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

      {overall.decided === 0 && (
        <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm">
          <p className="flex items-start gap-2 text-yellow-400">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Belum ada sinyal live yang teresolusi. Menunggu akumulasi sinyal
              butuh berbulan-bulan — jalankan harness backtest untuk mendapat
              angka hari ini:
              <code className="ml-1 px-1.5 py-0.5 rounded bg-background/60 font-mono text-xs">
                python -m core.backtest_harness --market stock_idx --mode both
              </code>
            </span>
          </p>
        </div>
      )}

      <ReliabilitySection
        curve={data.reliability}
        errorPp={data.calibration_error_pp}
      />
      <TierSection rows={data.by_tier} />
      <GateLiftSection rows={data.gate_lift} />
      <BacktestSection runs={data.backtest_runs} />
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

/** Confidence yang dilaporkan vs winrate yang benar-benar terjadi. */
function ReliabilitySection({
  curve,
  errorPp,
}: {
  curve: ReliabilityBucket[];
  errorPp: number | null;
}) {
  return (
    <Section
      title="Reliability — confidence vs kenyataan"
      hint={
        "`confidence` sekarang hanyalah proporsi gate yang lolos, bukan probabilitas. " +
        "Gap positif besar = sistem terlalu percaya diri." +
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
      hint="Dengan interval kepercayaan, supaya tier bersampel kecil tidak terbaca sekuat tier bersampel besar."
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
}: {
  runs: ReportCard["backtest_runs"];
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
    </Section>
  );
}
