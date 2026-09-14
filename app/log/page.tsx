import { Metadata } from "next";
import SignalLogContent from "./_content";

export const metadata: Metadata = {
  title: "Log Pencatatan | Trading System",
  description:
    "Apa saja yang dicatat sistem secara otomatis untuk tiap sinyal — siapa menulis apa, kapan, dan apa yang masih kosong.",
};

export default function SignalLogPage() {
  return (
    <div className="flex flex-col gap-6 p-6 w-full max-w-400 mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Log Pencatatan</h1>
        <p className="text-muted-foreground mt-2">
          Satu baris sinyal terlihat seperti satu kejadian — padahal ia hasil{" "}
          <strong className="text-foreground">tiga penulis</strong> pada tiga
          waktu berbeda. Scanner mengisi level &amp; gate saat terbit,{" "}
          <code className="text-xs">outcome_resolver</code> mengisi hasilnya
          berhari-hari kemudian, dan{" "}
          <code className="text-xs">signal_lifecycle</code> memperbarui status
          sampai jendelanya habis. Halaman ini memisahkan ketiganya.
        </p>
      </div>

      <SignalLogContent />
    </div>
  );
}
