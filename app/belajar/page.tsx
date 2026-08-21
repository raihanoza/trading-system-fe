import { Metadata } from "next";
import BelajarContent from "./_content";

export const metadata: Metadata = {
  title: "Belajar | Trading System",
  description:
    "Kartu gate dengan lift terukur, interval kepercayaan, dan vonis — plus konsep pengukuran yang membedakan 'kelihatan bekerja' dari 'terbukti bekerja'.",
};

export default function BelajarPage() {
  return (
    <div className="flex flex-col gap-6 p-6 w-full max-w-400 mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Belajar</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Materi trading di tempat lain berkata &ldquo;FVG itu sinyal
          kuat&rdquo;. Halaman ini berkata: <em>ini angkanya, ini ukuran
          sampelnya, dan ini vonisnya</em> — termasuk saat vonisnya
          &ldquo;belum terbukti&rdquo;. Membedakan &ldquo;kelihatan
          bekerja&rdquo; dari &ldquo;terbukti bekerja&rdquo; adalah hal
          terpenting yang bisa dipelajari seorang trader.
        </p>
      </div>

      <BelajarContent />
    </div>
  );
}
