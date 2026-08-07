import type { Metadata, Viewport } from "next";
import { Sora, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { TickerTape } from "@/components/layout/TickerTape";
import { Footer } from "@/components/layout/Footer";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
const jbmono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "CryptoPulse · AI 加密情报终端",
  description:
    "过去24小时最值得关注的中文 Crypto 信息，由 AI 自动筛选、聚类、分析、验证与持续追踪。",
  keywords: ["Crypto", "AI", "情报终端", "KOL", "信号", "加密货币"],
};

export const viewport: Viewport = {
  themeColor: "#06080c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={`${sora.variable} ${manrope.variable} ${jbmono.variable} dark`}>
      <body className="min-h-screen antialiased">
        <Header />
        <TickerTape />
        <main className="mx-auto max-w-[1480px] px-4 py-6 lg:px-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
