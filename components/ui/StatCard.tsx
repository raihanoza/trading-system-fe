import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
}

export default function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  loading,
}: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-muted-foreground font-medium">
          {label}
        </span>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-7 w-24 rounded-md shimmer" />
      ) : (
        <div
          className={cn(
            "text-xl font-bold font-mono tracking-tight",
            trend === "up"
              ? "text-profit"
              : trend === "down"
                ? "text-loss"
                : "text-foreground",
          )}
        >
          {value}
        </div>
      )}

      {sub && !loading && (
        <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      )}
    </div>
  );
}
