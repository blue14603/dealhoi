import { Search } from "lucide-react";
import Link from "next/link";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";

export const NAV_LINKS = [
  { href: "/uu-dai", label: "Khám phá" },
  { href: "/the-tin-dung", label: "Thẻ tín dụng" },
  { href: "/phuong-phap", label: "Cách DealHoi tính" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Bỏ qua điều hướng
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink">
              {l.label}
            </Link>
          ))}
          <Link href="/tim-kiem" className="ml-2 inline-flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-brand-bright">
            <Search className="size-4" aria-hidden /> Tìm deal
          </Link>
        </nav>
        <MobileNav links={NAV_LINKS} />
      </div>
    </header>
  );
}
