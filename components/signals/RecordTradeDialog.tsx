"use client";

import { useState } from "react";
import { Dialog, DialogField, DialogInput } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { describeApiError, isApiError } from "@/lib/api-error";
import { executionMode, refreshRuntime, useRuntime } from "@/lib/runtime";
import { formatIDR, formatPrice, cn } from "@/lib/utils";
import type { Signal } from "@/types";
import { toast } from "sonner";
import { Shield, Target, TrendingUp, AlertTriangle, Info } from "lucide-react";

interface Props {
  signal: Signal | null;
  onClose: () => void;
  onDone: () => void;
}

// Tier-specific guidance untuk Record Trade Dialog.
//
// Tier = LABEL hitungan konfluensi, bukan tingkat kualitas. Audit backend
// 25 Sep 2026 (trading-system audit/reports/06_tier_audit.md): skor/tier tidak
// memisahkan outcome di 7 pasar-jendela, dan sizer backend sudah DATAR 0,5 %
// untuk semua tier. Pesan lama ("Setup terbaik — full risk", "size 75 %",
// "size 50 %") menyarankan sizing berbasis tier yang terbukti tanpa dasar.
// Keputusan pemilik 26 Sep 2026 (S-1 b): nama tier tetap + keterangan tetap.
// RADAR dibedakan karena AKSINYA (WATCH, bukan BUY), bukan karena kualitasnya.
const BUY_TIER_NOTE =
  "Tier tidak memprediksi hasil — risiko sama untuk semua tier BUY.";

const TIER_GUIDANCE: Record<
  string,
  {
    warningLevel: "info" | "warning" | "danger" | null;
    title: string;
    message: string;
    defaultNote: string;
    suggestedSizeMultiplier: number; // 1.0 = full, 0.5 = half, dst
  }
> = {
  SNIPER: {
    warningLevel: "info",
    title: "Sniper — label konfluensi 5/5",
    message: BUY_TIER_NOTE,
    defaultNote: "",
    suggestedSizeMultiplier: 1.0,
  },
  PRECISION: {
    warningLevel: "info",
    title: "Precision — label konfluensi 4/5",
    message: BUY_TIER_NOTE,
    defaultNote: "",
    suggestedSizeMultiplier: 1.0,
  },
  STANDARD: {
    warningLevel: "info",
    title: "Standard — label konfluensi 3/5",
    message: BUY_TIER_NOTE,
    defaultNote: "",
    suggestedSizeMultiplier: 1.0,
  },
  SCOUT: {
    warningLevel: "info",
    title: "Scout — label konfluensi 2/5",
    message: BUY_TIER_NOTE,
    defaultNote: "",
    suggestedSizeMultiplier: 1.0,
  },
  RADAR: {
    warningLevel: "danger",
    title: "Radar — WATCH, bukan BUY",
    message:
      "Sistem tidak menerbitkan BUY untuk tier ini. Catat untuk observasi / paper trade saja; tier tidak memprediksi hasil.",
    defaultNote: "Radar tracking — observation/paper trade",
    suggestedSizeMultiplier: 0.25,
  },
};

export const NOTES_MAX = 2000;

/** null = lolos; selain itu pesan untuk pengguna. */
export function validateExecuteInput(units: string, notes: string): string | null {
  const n = Number(units);
  if (!units.trim() || !Number.isFinite(n) || n <= 0) {
    return "Units harus angka lebih besar dari 0.";
  }
  if (notes.length > NOTES_MAX) return `Catatan maksimal ${NOTES_MAX} karakter.`;
  return null;
}

export default function RecordTradeDialog({ signal, onClose, onDone }: Props) {
  const [units, setUnits] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { report } = useRuntime();
  const mode = executionMode(report);

  // Reset state when signal changes
  const [lastSignalId, setLastSignalId] = useState<number | null>(null);
  if (signal && signal.id !== lastSignalId) {
    setLastSignalId(signal.id);
    const guidance = TIER_GUIDANCE[signal.tier] ?? TIER_GUIDANCE.STANDARD;
    setNotes(guidance.defaultNote);
    setUnits("");
  }

  if (!signal) return null;

  const guidance = TIER_GUIDANCE[signal.tier] ?? TIER_GUIDANCE.STANDARD;
  const suggestedRisk = signal.risk_idr * guidance.suggestedSizeMultiplier;
  // Mode diketahui dari backend; null = belum terjawab (jalur galat menangani).
  const paper = mode === "paper";

  const handleSave = async () => {
    // Pagar yang sama dengan model request backend (api/models.py):
    // units > 0 dan finite, catatan ≤ 2000 karakter. Backend tetap pagar akhir.
    const problem = validateExecuteInput(units, notes);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      await api.trades.execute(signal.id, Number(units), notes);
      toast.success(`Trade tercatat — ${signal.display}`, {
        description: `${units} units @ ${formatPrice(signal.entry, signal.market)} · ${signal.tier}`,
      });
      onDone();
      onClose();
    } catch (e) {
      const d = describeApiError(e, "mencatat trade");
      toast.error(d.title, { description: [d.description, d.hint].filter(Boolean).join(" ") });
      if (isApiError(e) && e.kind === "paper_mode") void refreshRuntime();
    } finally {
      setSaving(false);
    }
  };

  // Hanya RADAR yang diperlakukan beda (aksinya WATCH). Cabang khusus SCOUT
  // ("Record Small Trade") dicabut 26 Sep 2026 — lihat TIER_GUIDANCE.
  const isRadar = signal.tier === "RADAR";

  return (
    <Dialog
      open={!!signal}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <div className="space-y-4">
        {paper && (
          <div
            role="note"
            data-testid="paper-mode-dialog-notice"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-200"
          >
            <p className="font-semibold text-amber-300">Mode PAPER aktif</p>
            Backend menolak pencatatan eksekusi live (HTTP 403) sampai edge
            terbukti. Tidak ada order uang nyata; sinyal ini tetap diukur otomatis
            oleh resolver.
          </div>
        )}

        {/* ✨ NEW: Tier-specific guidance banner */}
        {guidance.warningLevel && (
          <div
            className={cn(
              "flex items-start gap-3 px-3 py-2.5 rounded-xl border",
              guidance.warningLevel === "danger"
                ? "border-yellow-500/30 bg-yellow-500/10"
                : guidance.warningLevel === "warning"
                  ? "border-blue-500/30 bg-blue-500/10"
                  : "border-border bg-secondary/50",
            )}
          >
            {guidance.warningLevel === "danger" ? (
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p
                className={cn(
                  "text-xs font-semibold",
                  guidance.warningLevel === "danger"
                    ? "text-yellow-300"
                    : guidance.warningLevel === "warning"
                      ? "text-blue-300"
                      : "text-foreground",
                )}
              >
                {guidance.title}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                {guidance.message}
              </p>
            </div>
          </div>
        )}

        {/* Signal summary */}
        <div className="rounded-xl border border-border bg-secondary/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {signal.display}
            </span>
            <span className="text-xs text-muted-foreground">
              {signal.tier} · R:R 1:{signal.rr_ratio}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1 text-foreground">
              <TrendingUp className="w-3 h-3 text-muted-foreground" />
              {formatPrice(signal.entry, signal.market)}
            </div>
            <div className="flex items-center gap-1 text-loss">
              <Shield className="w-3 h-3" />
              {formatPrice(signal.stop_loss, signal.market)}
            </div>
            <div className="flex items-center gap-1 text-profit">
              <Target className="w-3 h-3" />
              {formatPrice(signal.take_profit, signal.market)}
            </div>
          </div>

          {/* ✨ NEW: Show suggested risk based on tier */}
          <div className="pt-2 border-t border-border/30 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Default Risk:</span>
              <span className="text-foreground font-medium">
                {formatIDR(signal.risk_idr)}
              </span>
            </div>
            {guidance.suggestedSizeMultiplier < 1.0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-yellow-400">
                  Suggested (
                  {Math.round(guidance.suggestedSizeMultiplier * 100)}%):
                </span>
                <span className="text-yellow-400 font-semibold">
                  {formatIDR(suggestedRisk)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Target:</span>
              <span className="text-profit font-medium">
                {formatIDR(signal.risk_idr * signal.rr_ratio)}
              </span>
            </div>
          </div>
        </div>

        {/* Units input */}
        <DialogField
          label={
            isRadar
              ? "Units (observation/minimal)"
              : "Units / Lot / Coin bought"
          }
        >
          <DialogInput
            type="number"
            placeholder={
              signal.market === "crypto"
                ? "e.g. 0.001 (BTC)"
                : signal.market.startsWith("stock")
                  ? "e.g. 100 (shares)"
                  : "e.g. 10000 (units)"
            }
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            min="0"
            step="any"
            autoFocus
          />
          {/* "Pakai 0 untuk paper tracking" dicabut 4 Okt 2026: backend kini
              menolak units ≤ 0 (422), dan mode paper menolak pencatatan
              eksekusi seluruhnya (403). */}
          <p className="text-[10px] text-muted-foreground mt-1">
            Wajib lebih besar dari 0 — jumlah yang benar-benar dieksekusi.
          </p>
        </DialogField>

        {/* Notes */}
        <DialogField label="Catatan (opsional)">
          <DialogInput
            placeholder={
              isRadar
                ? "Alasan tracking, observasi apa yang ditunggu..."
                : "Konfirmasi yang dilihat, alasan entry..."
            }
            value={notes}
            maxLength={NOTES_MAX}
            onChange={(e) => setNotes(e.target.value)}
          />
        </DialogField>

        {/* ✨ NEW: Extra confirmation untuk RADAR */}
        {isRadar && (
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-2.5 text-[10px] text-yellow-300/90 leading-relaxed">
            <strong>Pengingat:</strong> Trade ini akan tetap ter-record di
            journal dan analytics, tapi kamu HARUS sadar bahwa setup belum
            lengkap. Gunakan untuk learning, jangan ekspektasi profit dari Radar
            tier.
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || paper}
            title={paper ? "Dinonaktifkan: backend dalam mode paper" : undefined}
            className={cn(
              "flex-1",
              isRadar &&
                "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border-yellow-500/30",
            )}
          >
            {saving
              ? "Saving..."
              : isRadar
                ? "Track Observation"
                : "Record Trade"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
