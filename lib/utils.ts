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

/**
 * Batas "masih dianggap hidup" menurut sistem sendiri —
 * `duplicate_signal_window_days` di `config/settings.py` backend. Di luar
 * jendela itu C3 berhenti menganggap setup yang sama sebagai duplikat, yang
 * artinya sinyal lamanya tidak lagi dianggap aktif.
 */
export const STALE_AFTER_DAYS = 7;

/**
 * True kalau sinyal sudah lewat jendela aktifnya.
 *
 * Ada di sini, bukan inline di komponen, karena dua alasan: satu tempat yang
 * tahu angka 7, dan `Date.now()` di badan komponen melanggar aturan kemurnian
 * React 19 (hasilnya juga bisa beda antara render server dan klien).
 */
export function isStale(dateStr: string, days = STALE_AFTER_DAYS): boolean {
  return Date.now() - new Date(dateStr).getTime() > days * 86_400_000;
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
