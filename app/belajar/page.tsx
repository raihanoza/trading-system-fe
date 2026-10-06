import { Metadata } from "next";
import BelajarContent from "./_content";

export const metadata: Metadata = {
  title: "TradingOS Academy",
  description:
    "Kurikulum trading bertingkat dari pemula sampai expert dengan contoh chart, latihan praktik, kuis, dan simulator replay.",
};

export default function BelajarPage() {
  return (
    <div className="mx-auto w-full max-w-[1500px] p-2 sm:p-4">
      <BelajarContent />
    </div>
  );
}
