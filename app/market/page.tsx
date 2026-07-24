import { Metadata } from "next";
import MarketContent from "./_content";
export const metadata: Metadata = { title: "Market Overview" };
export default function MarketPage() {
  return <MarketContent />;
}
