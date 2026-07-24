"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  label: string;
  onScan: () => Promise<{ signals_found: number; message: string }>;
  variant?: "primary" | "secondary";
}

export default function ScanButton({
  label,
  onScan,
  variant = "secondary",
}: Props) {
  const [scanning, setScanning] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await onScan();
      if (result.signals_found > 0) {
        toast.success(`${result.signals_found} signal(s) found`, {
          description: result.message,
        });
      } else {
        toast.info("No signals", { description: result.message });
      }
    } catch (err) {
      toast.error("Scan failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <button
      onClick={handleScan}
      disabled={scanning}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
        "disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-secondary text-foreground border border-border hover:border-border/80 hover:bg-secondary/80",
      )}
    >
      <RefreshCw className={cn("w-3.5 h-3.5", scanning && "animate-spin")} />
      {scanning ? "Scanning..." : label}
    </button>
  );
}
