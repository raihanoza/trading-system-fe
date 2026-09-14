import { Metadata } from "next";
import ReportCardContent from "./_content";
import DailyReportCard from "./_daily";

export const metadata: Metadata = {
  title: "Report Card | Trading System",
  description:
    "Kalibrasi sistem: reliability curve, lift per gate, dan hit-rate per tier dengan interval kepercayaan.",
};

export default function ReportCardPage() {
  return (
    <div className="flex flex-col gap-6 p-6 w-full max-w-400 mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Report Card</h1>
        <p className="text-muted-foreground mt-2">
          Satu halaman untuk satu pertanyaan: layakkah sistem ini dipercaya?
          Angka di sini datang dengan interval kepercayaan — &ldquo;60% dari 12
          sinyal&rdquo; bukan klaim yang sama dengan &ldquo;60% dari 400&rdquo;.
        </p>
      </div>

      {/* Kartu HARIAN lebih dulu — ia yang dibaca tiap pagi, dan sebelum
          2 Sep 2026 satu-satunya cara melihatnya adalah menunggu WhatsApp
          pukul 07:00. Analitik kalibrasi di bawahnya menjawab pertanyaan yang
          sama tapi dari sisi lain: bukan "apa yang terjadi kemarin",
          melainkan "apakah angkanya bisa dipercaya". */}
      <DailyReportCard />

      <ReportCardContent />
    </div>
  );
}
