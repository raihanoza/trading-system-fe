"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Moon, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { api } from "@/lib/api";
import type { OvernightCandidate } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function ScoreDots({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5" title={`${score}/3`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "w-2 h-2 rounded-full",
            i < score ? "bg-primary" : "bg-border",
          )}
        />
      ))}
    </div>
  );
}

function CandidateCard({ c }: { c: OvernightCandidate }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{c.ticker}</span>
            <Badge variant="outline" className="text-[10px]">
              {c.submarket}
            </Badge>
            {c.duplicate && (
              <Badge variant="secondary" className="text-[10px]">
                sudah tercatat
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rp{c.price.toLocaleString("id-ID")}
          </p>
        </div>
        <ScoreDots score={c.score} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">CLV</p>
          <p className="font-medium">{(c.clv * 100).toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-muted-foreground">VWAP</p>
          <p
            className={cn(
              "font-medium flex items-center gap-1",
              c.above_vwap ? "text-emerald-500" : "text-red-500",
            )}
          >
            {c.above_vwap ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {c.above_vwap ? "di atas" : "di bawah"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Vol. akhir</p>
          <p className="font-medium">
            {(c.late_volume_share * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground/80 leading-relaxed border-t border-border pt-2">
        {c.reason}
      </p>
    </div>
  );
}

export default function OvernightContent() {
  const [candidates, setCandidates] = useState<OvernightCandidate[]>([]);
  const [activeTab, setActiveTab] = useState<"IDX" | "US">("IDX");
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const scan = useCallback(async (submarket: "idx" | "us") => {
    setScanning(true);
    setActiveTab(submarket === "idx" ? "IDX" : "US");
    try {
      const r = await api.scan.stockOvernight(submarket);
      setCandidates(r.candidates);
      setNote(r.note);
      if (r.candidates_found > 0) {
        toast.info(`${r.candidates_found} kandidat (belum terukur)`, {
          description: r.message,
        });
      } else {
        toast.info("Tidak ada kandidat", { description: r.message });
      }
    } catch (err) {
      toast.error("Scan gagal", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setScanning(false);
    }
  }, []);

  const filtered = candidates.filter((c) => c.submarket === activeTab);

  return (
    <div className="space-y-6">
      {/* Banner protokol 3.7 — selalu tampil, bukan cuma toast sekali */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <Moon className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
          <p className="font-semibold">Belum terukur — protokol 3.7</p>
          <p className="mt-1 text-amber-700/80 dark:text-amber-400/70">
            Kandidat di sini dicatat ke shadow log untuk diukur lift-nya,
            bukan rekomendasi siap pakai. Skor closing-strength (CLV, VWAP,
            volume jam terakhir) belum pernah dibuktikan prediktif.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => scan("idx")}
          disabled={scanning}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
            activeTab === "IDX"
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-secondary text-foreground border border-border hover:border-border/80",
          )}
        >
          <RefreshCw className={cn("w-3.5 h-3.5", scanning && "animate-spin")} />
          {scanning ? "Scanning..." : "Scan IDX 🇮🇩"}
        </button>
        <button
          onClick={() => scan("us")}
          disabled={scanning}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
            activeTab === "US"
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-secondary text-foreground border border-border hover:border-border/80",
          )}
        >
          <RefreshCw className={cn("w-3.5 h-3.5", scanning && "animate-spin")} />
          {scanning ? "Scanning..." : "Scan US 🇺🇸"}
        </button>
        <span className="text-xs text-muted-foreground ml-auto">
          Hanya menghasilkan kandidat di jendela menjelang tutup bursa.
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["IDX", "US"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab
                ? "bg-primary/15 text-primary border border-primary/25"
                : "text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            {tab === "IDX" ? "🇮🇩 IDX" : "🇺🇸 US"} (
            {candidates.filter((c) => c.submarket === tab).length})
          </button>
        ))}
      </div>

      {note && (
        <p className="text-xs text-muted-foreground/70 italic">{note}</p>
      )}

      {/* Candidates grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-border rounded-xl bg-card/40">
          <Moon className="w-8 h-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Tidak ada kandidat {activeTab}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Jalankan scan menjelang tutup bursa untuk melihat kandidat
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <CandidateCard key={c.ticker} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
