import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quản trị", robots: { index: false, follow: false } };

const LINKS = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/deals", label: "Ưu đãi" },
  { href: "/admin/cards", label: "Thẻ" },
  { href: "/admin/sources", label: "Nguồn" },
  { href: "/admin/import", label: "Nhập dữ liệu" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return (
    <div className="py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
        <nav aria-label="Quản trị" className="flex flex-wrap gap-1">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3 py-1.5 text-sm font-medium hover:bg-white/5">
              {l.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="flex items-center gap-3 text-sm text-ink-muted">
          <span>{session.email}</span>
          <button type="submit" className="rounded-full border border-line-strong px-3 py-1.5 font-medium text-ink hover:bg-white/5">
            Đăng xuất
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
