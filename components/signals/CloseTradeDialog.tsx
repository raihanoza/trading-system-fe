"use client";

import { useState } from "react";
import { Dialog, DialogField, DialogInput } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Trade } from "@/types";
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
    if (!exitPrice) {
      toast.error("Exit price wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const res = await api.trades.close(trade.id, Number(exitPrice), notes);
      const outcome =
        res.pnl_idr > 0 ? "✅ Win" : res.pnl_idr < 0 ? "❌ Loss" : "➖ Breakeven";
      toast.success(`Trade closed — ${outcome}`, {
        description: `P&L Rp${res.pnl_idr.toLocaleString("id-ID")}`,
      });
      onDone();
      onClose();
    } catch (e) {
      toast.error("Failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
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
