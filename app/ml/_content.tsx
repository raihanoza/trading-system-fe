"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { apiGet, apiSend } from "@/lib/api";
import { describeApiError } from "@/lib/api-error";
import { ApiErrorNotice } from "@/components/system/StateNotice";
import { toast } from "sonner";
import {
  Brain,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Zap,
  Info,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ModelStatus {
  trained: boolean;
  samples?: number;
  accuracy?: number;
  trained_at?: string;
  gate_weights?: Record<string, number>;
  message?: string;
}

interface TrainResult {
  trained: boolean;
  samples: number;
  accuracy_pct: number;
  precision_pct: number;
  recall_pct: number;
  gate_weights: Record<string, number>;
  feature_importance: {
    gate: string;
    importance: number;
    weight: number;
    direction: string;
  }[];
  tier_adjustments: Record<
    string,
    Record<string, { win_rate: number; total: number; bias: number }>
  >;
  trained_at: string;
  message: string;
}

interface WeightItem {
  gate: string;
  weight: number;
  direction: string;
  label: string;
}

interface Insights {
  trained: boolean;
  samples: number;
  accuracy: number;
  trained_at: string;
  insights: {
    most_predictive_gates: { gate: string; weight: number; meaning: string }[];
    least_predictive_gates: { gate: string; weight: number; meaning: string }[];
    recommendation: string;
  };
  minimum_trades_needed?: number;
  message?: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const GATE_LABELS: Record<string, string> = {
  htf_trend_aligned: "HTF Trend Aligned",
  bos_or_choch: "BOS / CHoCH",
  price_in_poi: "Price in POI",
  volume_spike: "Volume Spike",
  volume_absorption: "Volume Absorption",
  liquidity_sweep_done: "Liquidity Sweep",
  fvg_present: "FVG Present",
  htf_candle_close: "HTF Candle Close",
  triple_confluence: "Triple Confluence",
  no_high_impact_news: "No High Impact News",
  kill_zone: "Kill Zone",
  pdh_pdl_taken: "PDH/PDL Taken",
};

function Section({
  title,
  icon: Icon,
  children,
  badge,
}: {
  title: string;
  icon: React.FC<{ className?: string }>;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {badge && (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/25 font-medium">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function WeightBar({ weight }: { weight: number }) {
  // weight 0.5 - 2.0 = ketergantungan model pada gate, BUKAN arah manfaat.
  // Hijau/merah dicabut 4 Okt 2026: warna untung/rugi menyatakan arah yang
  // tidak diukur oleh feature importance (tak bertanda).
  const pct = ((weight - 0.5) / 1.5) * 100;
  const high = weight >= 1.1;

  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            high ? "bg-primary/70" : "bg-secondary-foreground/20",
          )}
          style={{ width: `${Math.max(5, pct)}%` }}
        />
      </div>
      <span
        className={cn(
          "text-xs font-mono w-10 text-right shrink-0 font-semibold",
          high ? "text-foreground" : "text-muted-foreground",
        )}
      >
        ×{weight.toFixed(2)}
      </span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MLContent() {
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [weights, setWeights] = useState<WeightItem[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState<TrainResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  // Dulu `fetch(...).then(r => r.json())` tanpa memeriksa status: 500 dari
  // backend dibaca sebagai objek status kosong, layar tampil "Not Trained".
  const fetchStatus = useCallback(
    () =>
      Promise.all([
        apiGet<ModelStatus>("/ml/status"),
        apiGet<{ weights?: WeightItem[] }>("/ml/gate-weights"),
        apiGet<Insights>("/ml/insights"),
      ])
        .then(([s, w, i]) => {
          setStatus(s);
          setWeights(w.weights ?? []);
          setInsights(i);
          setLoadError(null);
        })
        .catch((e: unknown) => setLoadError(e))
        .finally(() => setLoading(false)),
    [],
  );

  const loadStatus = useCallback(() => {
    setLoading(true);
    return fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    // setState hanya di callback promise — bukan sinkron di badan effect.
    void fetchStatus();
  }, [fetchStatus]);

  const train = async () => {
    setTraining(true);
    try {
      const r = await apiSend<TrainResult>("POST", "/ml/train");
      setTrainResult(r);
      if (r.trained) await loadStatus();
    } catch (e) {
      const d = describeApiError(e, "melatih model");
      toast.error(d.title, { description: [d.description, d.hint].filter(Boolean).join(" ") });
    } finally {
      setTraining(false);
    }
  };

  const isTrained = status?.trained;

  return (
    <div className="space-y-5">
      {/* Header info */}
      <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            ML Signal Optimizer
            <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-px text-[10px] font-semibold text-amber-300">
              EKSPERIMENTAL
            </span>
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Random Forest dilatih dari jurnal trade untuk memisahkan win dan loss
            berdasarkan gate yang menyala. Hasilnya{" "}
            <strong className="text-foreground">tidak dipakai scanner</strong>{" "}
            — skor dan tier dihitung kebijakan tetap (weighted-v1) — dan bukan
            dasar untuk mengubah tier atau ukuran posisi.
          </p>
          <p className="text-[11px] text-amber-400/90 mt-1.5 leading-relaxed">
            Feature importance tidak bertanda: gate yang sangat membantu model
            memprediksi KERUGIAN juga mendapat importance tinggi. Data latih belum
            dipisah per kontrak tier, dan akurasi model belum dibandingkan dengan
            baseline maupun dikalibrasi (audit 4 Okt 2026, temuan 7).
          </p>
        </div>
        <button
          onClick={train}
          disabled={training || loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shrink-0"
        >
          {training ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Brain className="w-4 h-4" />
          )}
          {training ? "Training..." : isTrained ? "Retrain" : "Train Model"}
        </button>
      </div>

      {/* Train result */}
      {trainResult && (
        <div
          className={cn(
            "rounded-xl border p-4",
            trainResult.trained
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-yellow-500/30 bg-yellow-500/5",
          )}
        >
          <div className="flex items-start gap-3">
            {trainResult.trained ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p
                className={cn(
                  "text-sm font-medium",
                  trainResult.trained ? "text-emerald-400" : "text-yellow-400",
                )}
              >
                {trainResult.trained
                  ? "Training Berhasil"
                  : "Training Tidak Bisa Dilakukan"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {trainResult.message}
              </p>
              {trainResult.trained && (
                <div className="flex gap-4 mt-2 text-[11px]">
                  <span className="text-foreground">
                    Samples: <strong>{trainResult.samples}</strong>
                  </span>
                  <span className="text-foreground">
                    Accuracy:{" "}
                    <strong className="text-profit">
                      {trainResult.accuracy_pct}%
                    </strong>
                  </span>
                  <span className="text-foreground">
                    Precision: <strong>{trainResult.precision_pct}%</strong>
                  </span>
                  <span className="text-foreground">
                    Recall: <strong>{trainResult.recall_pct}%</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-border shimmer"
            />
          ))}
        </div>
      ) : loadError ? (
        <ApiErrorNotice
          error={loadError}
          action="memuat status ML"
          onRetry={() => void loadStatus()}
        />
      ) : (
        <>
          {/* Model status */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Status",
                value: isTrained ? "✅ Trained" : "⚠️ Not Trained",
                color: isTrained ? "text-profit" : "text-warning",
              },
              {
                label: "Samples",
                value: isTrained ? String(status?.samples ?? 0) : "—",
                color: "text-foreground",
              },
              {
                label: "Accuracy",
                value: isTrained
                  ? `${((status?.accuracy ?? 0) * 100).toFixed(1)}%`
                  : "—",
                color: "text-foreground",
              },
              {
                label: "Last Train",
                value:
                  isTrained && status?.trained_at
                    ? new Date(status.trained_at).toLocaleDateString("id-ID")
                    : "Never",
                color: "text-muted-foreground",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-border bg-card p-4"
              >
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className={cn("text-lg font-bold font-mono", s.color)}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Not trained state */}
          {!isTrained && (
            <Section title="Cara Kerja" icon={Info}>
              <div className="p-5 space-y-4">
                <div className="space-y-3">
                  {[
                    {
                      step: "1",
                      title: "Kumpulkan Data",
                      desc: "Setiap trade yang kamu tutup (win/loss) tersimpan di journal. ML butuh minimal 20 closed trades.",
                      icon: "📊",
                    },
                    {
                      step: "2",
                      title: "Train Model",
                      desc: "Klik 'Train Model' — Random Forest belajar dari pola: gate apa yang sering ada di trade win vs loss.",
                      icon: "🧠",
                    },
                    {
                      step: "3",
                      title: "Importance → bobot tampilan",
                      desc: "Importance tiap gate dipetakan ke angka 0,5–2. Angka itu menunjukkan seberapa banyak model bergantung pada gate tersebut — BUKAN arah manfaatnya (naik ≠ lebih menguntungkan).",
                      icon: "⚖️",
                    },
                    {
                      step: "4",
                      title: "Tidak diterapkan otomatis",
                      desc: "Scanner aktif tidak membaca bobot ini. Skor sinyal tetap dihitung kebijakan tetap weighted-v1; mengubahnya butuh protokol pengujian terpisah.",
                      icon: "🛑",
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-sm">
                        {item.icon ?? item.step}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-xs text-yellow-400">
                  <strong>Saat ini:</strong> Kamu butuh lebih banyak closed
                  trades. Terus trading, close trade dengan profit/loss, dan
                  kembali ke halaman ini setelah 20+ trades.
                </div>
              </div>
            </Section>
          )}

          {/* Gate weights — tampil jika trained */}
          {isTrained && weights.length > 0 && (
            <Section
              title="Gate Weights — Hasil Pembelajaran"
              icon={Zap}
              badge={`${weights.length} gates`}
            >
              <div className="divide-y divide-border">
                {weights.map((w) => (
                  <div
                    key={w.gate}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <div className="w-48 shrink-0">
                      <p className="text-xs font-medium text-foreground">
                        {GATE_LABELS[w.gate] ?? w.gate.replace(/_/g, " ")}
                      </p>
                      {/* Backend melabeli bobot > 1 "positive" — label itu
                          dibaca dari importance tak bertanda, jadi tidak
                          ditampilkan sebagai untung/rugi. */}
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-md border text-muted-foreground bg-secondary border-border"
                        title={`Label backend: ${w.label} (dari importance tak bertanda)`}
                      >
                        {w.weight >= 1.1
                          ? "ketergantungan tinggi"
                          : w.weight <= 0.9
                            ? "ketergantungan rendah"
                            : "netral"}
                      </span>
                    </div>
                    <WeightBar weight={w.weight} />
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-border bg-secondary/20">
                <p className="text-[11px] text-muted-foreground">
                  ×1.00 = default · ×{">"} 1.10 = model lebih bergantung pada gate
                  ini · ×{"<"} 0.90 = model jarang memakainya. Tidak menyatakan
                  apakah gate ini menaikkan atau menurunkan peluang profit, dan
                  tidak dipakai scanner.
                </p>
              </div>
            </Section>
          )}

          {/* Insights */}
          {isTrained && insights?.trained && insights.insights && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Section title="Importance tertinggi (tak bertanda)" icon={TrendingUp}>
                {insights.insights.most_predictive_gates.length === 0 ? (
                  <div className="p-5 text-sm text-muted-foreground">
                    Butuh lebih banyak data
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {insights.insights.most_predictive_gates.map((g, i) => (
                      <div
                        key={g.gate}
                        className="flex items-center gap-3 px-5 py-3"
                      >
                        <span className="text-xs text-muted-foreground w-4">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground">
                            {GATE_LABELS[g.gate] ?? g.gate.replace(/_/g, " ")}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {g.meaning}
                          </p>
                        </div>
                        <span className="text-xs font-mono text-foreground font-semibold shrink-0">
                          ×{g.weight.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Importance terendah (tak bertanda)" icon={TrendingDown}>
                {insights.insights.least_predictive_gates.length === 0 ? (
                  <div className="p-5 text-sm text-muted-foreground">
                    Tidak ada gate berimportance rendah
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {insights.insights.least_predictive_gates.map((g, i) => (
                      <div
                        key={g.gate}
                        className="flex items-center gap-3 px-5 py-3"
                      >
                        <span className="text-xs text-muted-foreground w-4">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground">
                            {GATE_LABELS[g.gate] ?? g.gate.replace(/_/g, " ")}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {g.meaning}
                          </p>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground font-semibold shrink-0">
                          ×{g.weight.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* Recommendation */}
          {isTrained &&
            insights?.trained &&
            insights.insights?.recommendation && (
              <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-primary/20 bg-primary/5">
                <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-primary mb-0.5">
                    Teks otomatis model (eksperimental — bukan rekomendasi
                    mengubah tier atau sizing)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {insights.insights.recommendation}
                  </p>
                </div>
              </div>
            )}

          {/* When to retrain */}
          {isTrained && (
            <div className="px-4 py-3 rounded-xl border border-border bg-secondary/30 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">
                Kapan perlu retrain?
              </p>
              <p>· Setelah 20+ trade baru ditutup</p>
              <p>
                · Jika win rate berubah signifikan ({">"} 10%) dari biasanya
              </p>
              <p>· Setelah mengubah strategi atau market focus</p>
              <p>· Minimal sebulan sekali untuk keep model fresh</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
