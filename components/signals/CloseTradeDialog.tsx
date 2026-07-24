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
  const [pnl, setPnl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!trade) return null;

  // Auto-calculate PnL hint
  const calcPnl = () => {
    if (!exitPrice || isNaN(Number(exitPrice))) return null;
    const diff = (Number(exitPrice) - trade.entry) * trade.units;
    return diff;
  };

  const pnlHint = calcPnl();

  const handleClose = async () => {
    if (!exitPrice || !pnl) {
      toast.error("Fill all fields");
      return;
    }
    setSaving(true);
    try {
      await api.trades.close(trade.id, Number(exitPrice), Number(pnl), notes);
      const outcome =
        Number(pnl) > 0
          ? "✅ Win"
          : Number(pnl) < 0
            ? "❌ Loss"
            : "➖ Breakeven";
      toast.success(`Trade closed — ${outcome}`);
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
          {pnlHint !== null && (
            <p
              className={`text-xs mt-1 ${pnlHint >= 0 ? "text-profit" : "text-loss"}`}
            >
              Estimated P&L: {pnlHint >= 0 ? "+" : ""}
              {pnlHint.toFixed(2)}{" "}
              {trade.market.includes("stock_idx") ? "IDR" : "USD"}
            </p>
          )}
        </DialogField>

        <DialogField label="P&L in IDR (positive = profit)">
          <DialogInput
            type="number"
            placeholder="e.g. 45000 or -30000"
            value={pnl}
            onChange={(e) => setPnl(e.target.value)}
          />
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
