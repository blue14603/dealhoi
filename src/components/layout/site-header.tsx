import Link from "next/link";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";

export const NAV_LINKS = [
  { href: "/uu-dai", label: "Ưu đãi" },
  { href: "/the-tin-dung", label: "Thẻ tín dụng" },
  { href: "/phuong-phap", label: "Cách DealHoi tính" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Bỏ qua điều hướng
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-4 py-2 text-sm font-medium text-ink-muted hover:bg-black/5 hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <MobileNav links={NAV_LINKS} />
      </div>
    </header>
  );
}
