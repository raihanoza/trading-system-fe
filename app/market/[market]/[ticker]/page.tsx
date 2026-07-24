import { Metadata } from "next";
import DetailContent from "./_content";

export const metadata: Metadata = { title: "Asset Detail" };

export default async function DetailPage({
  params,
}: {
  params: Promise<{ market: string; ticker: string }>;
}) {
  const { market, ticker } = await params;
  return <DetailContent market={market} ticker={decodeURIComponent(ticker)} />;
}
