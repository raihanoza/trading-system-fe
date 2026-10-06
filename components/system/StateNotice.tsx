import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { describeApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";

/**
 * Galat API yang sudah diklasifikasikan. Dipisah dari keadaan kosong dengan
 * sengaja: "backend mati" dan "belum ada data" dulu tampil sama ("No trades",
 * "Belum ada sinyal tersimpan"), padahal tindak lanjutnya berbeda.
 */
export function ApiErrorNotice({
  error,
  action = "memuat data",
  onRetry,
  className,
}: {
  error: unknown;
  action?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const d = describeApiError(error, action);
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm",
        className,
      )}
    >
      <p className="flex items-start gap-2 font-medium text-destructive">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{d.title}</span>
      </p>
      <p className="mt-1 ml-6 text-xs text-foreground/80">{d.description}</p>
      {d.hint && <p className="mt-1 ml-6 text-xs text-muted-foreground">{d.hint}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 ml-6 inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
        >
          <RefreshCw className="w-3 h-3" /> Coba lagi
        </button>
      )}
    </div>
  );
}

/** Keadaan kosong yang menyebut apa yang kosong dan apa artinya. */
export function EmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card/40 px-4 py-10 text-center",
        className,
      )}
    >
      <Inbox className="w-7 h-7 text-muted-foreground/40 mb-1" />
      <p className="text-sm text-muted-foreground">{title}</p>
      {description && (
        <p className="max-w-md text-xs text-muted-foreground/70">{description}</p>
      )}
    </div>
  );
}
