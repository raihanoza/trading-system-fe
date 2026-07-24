"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  TrendingUp,
  Bitcoin,
  DollarSign,
  BookOpen,
  Activity,
  Settings,
  Zap,
  Book,
  Radio,
  Brain,
  Rewind,
  Table,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", icon: Activity, label: "Overview" },
  { href: "/market", icon: Table, label: "Market" },
  { href: "/stock", icon: TrendingUp, label: "Stock" },
  { href: "/crypto", icon: Bitcoin, label: "Crypto" },
  { href: "/forex", icon: DollarSign, label: "Forex" },
  { href: "/trades", icon: BookOpen, label: "Trades" },
  { href: "/stats", icon: BarChart3, label: "Analytics" },
  { href: "/journal", icon: Book, label: "Journal" },
  { href: "/sentiment", icon: Radio, label: "Sentiment" },
  { href: "/backtest", icon: Rewind, label: "Backtest" },
  { href: "/ml", icon: Brain, label: "ML Optimizer" },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-16 lg:w-56 bg-card border-r border-border flex flex-col z-50">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="hidden lg:block text-sm font-semibold tracking-tight text-foreground">
            TradingOS
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all",
                "hover:bg-secondary hover:text-foreground",
                active
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden lg:block font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-border">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span className="hidden lg:block font-medium">Settings</span>
        </Link>
      </div>
    </aside>
  );
}
