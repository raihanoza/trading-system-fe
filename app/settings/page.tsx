import { Metadata } from "next";
import SystemContent from "./_content";

export const metadata: Metadata = {
  title: "Sistem & Runtime",
  description:
    "Identitas build frontend, versi backend, mode paper/live, status koneksi API, dan arti angka.",
};

export default function SystemPage() {
  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sistem & Runtime</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Versi yang sedang Anda lihat, backend yang melayaninya, dan mode eksekusinya.
        </p>
      </div>
      <SystemContent />
    </div>
  );
}
