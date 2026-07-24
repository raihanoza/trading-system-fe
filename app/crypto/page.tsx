import { Metadata } from "next";
import CryptoContent from "./_content";

export const metadata: Metadata = {
  title: "Crypto | Trading System",
  description:
    "Track your executed trades, open positions, and analyze your performance.",
};

export default function CryptoPage() {
  return (
    <div className="flex flex-col gap-6 p-6 w-full max-w-400 mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Crypto</h1>
        <p className="text-muted-foreground mt-2">
          Review your previous trades and manage open positions.
        </p>
      </div>

      <CryptoContent />
    </div>
  );
}
