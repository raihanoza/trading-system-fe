import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatIDR(amount: number): string {
  if (Math.abs(amount) >= 1_000_000)
    return `Rp${(amount / 1_000_000).toFixed(1)}jt`;
  if (Math.abs(amount) >= 1_000) return `Rp${(amount / 1_000).toFixed(0)}rb`;
  return `Rp${amount.toFixed(0)}`;
}

export function formatPrice(price: number, market: string): string {
  if (market === "forex") return price.toFixed(5);
  if (market === "crypto")
    return price < 1 ? price.toFixed(6) : price.toFixed(2);
  if (market === "stock_idx") return price.toLocaleString("id-ID");
  return `$${price.toFixed(2)}`;
}

export function formatPct(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function getWIBTime(): string {
  return (
    new Date().toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}
