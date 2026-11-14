import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { DemoBanner } from "@/components/layout/demo-banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { config } from "@/lib/config";
import "./globals.css";

const font = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "DealHoi — So sánh ưu đãi thẻ tín dụng", template: "%s · DealHoi" },
  description: "Tìm ưu đãi thẻ tín dụng phù hợp với thứ bạn mua và cách bạn chi tiêu. Dữ liệu có nguồn, có ngày xác minh.",
};

export const viewport: Viewport = { themeColor: "#dc2626", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={font.variable}>
      <body className="min-h-dvh antialiased">
        <SiteHeader />
        {config.includeDemoData && <DemoBanner />}
        <main id="main" className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
