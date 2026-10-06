"use client";

import { useState } from "react";
import { Dialog, DialogField, DialogInput } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { describeApiError, isApiError } from "@/lib/api-error";
import type { Trade } from "@/types";
import { NOTES_MAX } from "./RecordTradeDialog";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  trade: Trade | null;
  onClose: () => void;
  onDone: () => void;
}

export default function CloseTradeDialog({ trade, onClose, onDone }: Props) {
  const [exitPrice, setExitPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!trade) return null;

  // Perkiraan KASAR, sengaja dilabeli begitu: ini selisih harga x unit dalam
  // mata uang instrumen, TANPA biaya dan TANPA konversi kurs. Angka yang
  // disimpan dihitung server (`realized_pnl_idr`) dan bisa berbeda jauh — di
  // crypto, selisihnya sebesar kurs USD→IDR.
  const calcGross = () => {
    if (!exitPrice || isNaN(Number(exitPrice))) return null;
    return (Number(exitPrice) - trade.entry) * trade.units;
  };

  const gross = calcGross();
  const quoteCcy = trade.market.includes("stock_idx") ? "IDR" : "USD";

  const handleClose = async () => {
    // Pagar yang sama dengan backend: harga exit > 0 dan finite.
    const price = Number(exitPrice);
    if (!exitPrice.trim() || !Number.isFinite(price) || price <= 0) {
      toast.error("Harga exit harus angka lebih besar dari 0.");
      return;
    }
    if (notes.length > NOTES_MAX) {
      toast.error(`Catatan maksimal ${NOTES_MAX} karakter.`);
      return;
    }
    setSaving(true);
    try {
      const res = await api.trades.close(trade.id, price, notes);
      const outcome =
        res.pnl_idr > 0 ? "✅ Win" : res.pnl_idr < 0 ? "❌ Loss" : "➖ Breakeven";
      toast.success(`Trade ditutup — ${outcome}`, {
        description: `P&L Rp${res.pnl_idr.toLocaleString("id-ID")} (dihitung server: biaya, arah, kurs)`,
      });
      onDone();
      onClose();
    } catch (e) {
      const d = describeApiError(e, "menutup trade");
      toast.error(d.title, { description: [d.description, d.hint].filter(Boolean).join(" ") });
      // 409 = sudah ditutup (di tab lain / oleh auto-close). Keadaan di layar
      // basi: muat ulang daftar dan tutup dialog, jangan biarkan dicoba lagi.
      if (isApiError(e) && (e.kind === "conflict" || e.kind === "not_found")) {
        onDone();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!trade}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-secondary/50 p-3 text-xs space-y-1">
          <p className="font-semibold text-foreground">{trade.ticker}</p>
          <p className="text-muted-foreground">
            Entry:{" "}
            <span className="text-foreground">
              {formatPrice(trade.entry, trade.market)}
            </span>
            {" · "}
            Units: <span className="text-foreground">{trade.units}</span>
          </p>
        </div>

        <DialogField label="Exit Price">
          <DialogInput
            type="number"
            placeholder={`e.g. ${formatPrice(trade.take_profit, trade.market)}`}
            value={exitPrice}
            onChange={(e) => setExitPrice(e.target.value)}
            min="0"
            step="any"
            autoFocus
          />
          {gross !== null && (
            <div className="mt-1 space-y-0.5">
              <p
                className={`text-xs ${gross >= 0 ? "text-profit" : "text-loss"}`}
              >
                Selisih kasar: {gross >= 0 ? "+" : ""}
                {gross.toFixed(2)} {quoteCcy}
              </p>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Angka di atas BELUM dipotong biaya
                {quoteCcy !== "IDR" && " dan belum dikonversi ke rupiah"}. P&L
                yang disimpan dihitung server — biaya, arah, dan kurs sekaligus.
              </p>
            </div>
          )}
        </DialogField>

        <DialogField label="Notes (optional)">
          <DialogInput
            placeholder="e.g. TP hit, SL hit, manual close"
            value={notes}
            maxLength={NOTES_MAX}
            onChange={(e) => setNotes(e.target.value)}
          />
        </DialogField>

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleClose} disabled={saving} className="flex-1">
            {saving ? "Closing..." : "Close Trade"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
