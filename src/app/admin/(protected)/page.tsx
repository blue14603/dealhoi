import Link from "next/link";
import { Button } from "@/components/ui/button";
import { adminDashboardStats } from "@/lib/admin/admin-data";
import { requireAdmin } from "@/lib/admin/auth";
import { formatTimestampDate } from "@/lib/domain/format";
import { CheckCircle2, Circle } from "lucide-react";
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
  const n = (v: unknown) => Number(v ?? 0);
  const steps = [
    {
      title: "Nhập dữ liệu",
      href: "/admin/import",
      remaining: n(counts.total_deals) === 0 ? 1 : 0,
      todo: "Chạy crawler, rồi nhập stubs.json trước, bundle.json sau.",
      done: `${n(counts.total_deals)} ưu đãi trong hệ thống.`,
      guide: "nhap",
    },
    {
      title: "Duyệt nguồn",
      href: "/admin/sources",
      remaining: n(counts.unreviewed_sources),
      todo: `${n(counts.unreviewed_sources)} nguồn chưa duyệt: mở nguồn, so với dữ liệu, đánh dấu đã duyệt.`,
      done: "Mọi nguồn đã được duyệt.",
      guide: "nguon",
    },
    {
      title: "Hoàn thiện và xác minh thẻ",
      href: "/admin/cards",
      remaining: n(counts.unverified_cards),
      todo: `${n(counts.unverified_cards)} thẻ chưa xác minh${n(counts.cards_missing_fee) ? `, ${n(counts.cards_missing_fee)} thẻ chưa có phí thường niên` : ""}.`,
      done: "Mọi thẻ đã được xác minh.",
      guide: "the",
    },
    {
      title: "Kiểm tra và xuất bản ưu đãi",
      href: "/admin/deals?status=draft",
      remaining: n(counts.drafts) + n(counts.needs_review),
      todo: `${n(counts.drafts)} bản nháp, ${n(counts.needs_review)} cần xác minh lại${n(counts.deals_without_cards) ? `, ${n(counts.deals_without_cards)} chưa có thẻ` : ""}.`,
      done: "Không còn ưu đãi chờ duyệt.",
      guide: "uu-dai",
    },
    {
      title: "Dọn ưu đãi hết hạn",
      href: "/admin/deals?status=published",
      remaining: n(counts.expired_published),
      todo: `${n(counts.expired_published)} ưu đãi đã hết hạn nhưng còn xuất bản: dùng nút bên dưới.`,
      done: "Không có ưu đãi quá hạn đang hiển thị.",
      guide: "dinh-ky",
    },
  ];
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Tổng quan dữ liệu</h1>
      <section aria-labelledby="todo" className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="todo" className="text-lg font-bold">Việc cần làm</h2>
          <Link href="/admin/huong-dan" className="text-sm font-medium text-brand hover:underline">Hướng dẫn đầy đủ</Link>
        </div>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              {s.remaining === 0 ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-savings" aria-label="Xong" />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-ink-subtle" aria-label="Chưa xong" />
              )}
              <div className="text-sm">
                <Link href={s.href} className="font-semibold hover:text-brand">
                  {i + 1}. {s.title}
                </Link>
                <p className="text-ink-muted">
                  {s.remaining === 0 ? s.done : s.todo}{" "}
                  <Link href={`/admin/huong-dan#${s.guide}`} className="text-brand hover:underline">Cách làm</Link>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
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
