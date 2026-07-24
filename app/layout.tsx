import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Trading System",
    default: "Trading System",
  },
  description: "Institutional signal system — Stock · Crypto · Forex",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}
      >
        <Sidebar />
        <div className="flex-1 ml-16 lg:ml-56 flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "hsl(220 13% 10%)",
              border: "1px solid hsl(220 13% 15%)",
              color: "hsl(210 20% 94%)",
            },
          }}
        />
      </body>
    </html>
  );
}
