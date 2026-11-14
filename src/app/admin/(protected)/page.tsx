import Link from "next/link";
import { Button } from "@/components/ui/button";
import { adminDashboardStats } from "@/lib/admin/admin-data";
import { requireAdmin } from "@/lib/admin/auth";
import { formatTimestampDate } from "@/lib/domain/format";
import { withdrawExpiredAction } from "../actions";

export default async function AdminHome() {
  await requireAdmin();
  const { counts, audit } = await adminDashboardStats();
  const tiles = [
    { label: "Ưu đãi đang xuất bản", value: counts.published, href: "/admin/deals?status=published" },
    { label: "Cần xác minh lại", value: counts.needs_review, href: "/admin/deals?status=needs_review" },
    { label: "Bản nháp", value: counts.drafts, href: "/admin/deals?status=draft" },
    { label: "Đã hết hạn nhưng còn xuất bản", value: counts.expired_published, href: "/admin/deals?status=published" },
    { label: "Nguồn chưa duyệt", value: counts.unreviewed_sources, href: "/admin/sources" },
    { label: "Thẻ chưa xác minh", value: counts.unverified_cards, href: "/admin/cards" },
  ];
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Tổng quan dữ liệu</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="rounded-2xl border border-line bg-surface p-4 hover:shadow-sm">
            <p className="text-sm text-ink-muted">{t.label}</p>
            <p className="mt-1 text-3xl font-bold tabular">{String(t.value)}</p>
          </Link>
        ))}
      </div>
      {Number(counts.expired_published) > 0 && (
        <form action={withdrawExpiredAction}>
          <Button type="submit" variant="secondary">Ngừng hiển thị tất cả ưu đãi đã hết hạn</Button>
        </form>
      )}
      <section>
        <h2 className="mb-3 text-lg font-bold">Hoạt động gần đây</h2>
        {audit.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
            {audit.map((a, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span>{String(a.actor_email)} · {String(a.action)} · {String(a.entity_type)}</span>
                <span className="text-ink-muted">{formatTimestampDate(new Date(a.created_at as string).toISOString())}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">Chưa có hoạt động.</p>
        )}
      </section>
    </div>
  );
}
