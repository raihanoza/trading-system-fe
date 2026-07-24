import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
      <p className="text-4xl font-bold font-mono text-muted-foreground/30">
        404
      </p>
      <p className="text-sm text-muted-foreground">Page not found</p>
      <Link href="/" className="text-xs text-primary hover:underline">
        ← Back to overview
      </Link>
    </div>
  );
}
