import { Metadata } from "next";

import OvernightContent from "./_content";

export const metadata: Metadata = {
  title: "Overnight Flip | Trading System",
  description:
    "Beli menjelang tutup, nilai di open sesi berikutnya. Strategi kedua modul stock — belum terukur (protokol 3.7).",
};

export default function OvernightPage() {
  return (
    <div className="flex flex-col gap-6 p-6 w-full max-w-400 mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Overnight Flip 🌙
        </h1>
        <p className="text-muted-foreground mt-2">
          Beli menjelang tutup bursa, nilai di open sesi berikutnya. Tesis
          &quot;kekuatan closing&quot; — bukan gate teknikal seperti strategi
          swing.
        </p>
      </div>

      <OvernightContent />
    </div>
  );
}
