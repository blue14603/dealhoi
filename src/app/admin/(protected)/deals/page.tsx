import Link from "next/link";
import { PageHint } from "@/components/admin/page-hint";
import { Badge } from "@/components/ui/badge";
import { listAdminDeals } from "@/lib/admin/admin-data";
import { requireAdmin } from "@/lib/admin/auth";
import { formatDate } from "@/lib/domain/format";
import { LIFECYCLE_LABELS, type DealLifecycle } from "@/lib/domain/validity";
import { setDealStatusAction } from "../../actions";

const FILTERS = [
  { v: "", label: "Tất cả" },
  { v: "published", label: "Đã xuất bản" },
  { v: "draft", label: "Nháp" },
  { v: "needs_review", label: "Cần xác minh" },
  { v: "withdrawn", label: "Đã dừng" },
];

export default async function AdminDeals({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status } = await searchParams;
  const valid = FILTERS.some((f) => f.v === status) ? status : undefined;
  const deals = await listAdminDeals({ status: valid || undefined });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ưu đãi ({deals.length})</h1>
      <PageHint guide="uu-dai">Mở từng ưu đãi, đối chiếu với trang nguồn, kiểm tra thẻ đủ điều kiện, rồi chọn verified và xuất bản.</PageHint>
      <nav className="flex flex-wrap gap-2" aria-label="Lọc trạng thái">
        {FILTERS.map((f) => (
          <Link key={f.v} href={f.v ? `/admin/deals?status=${f.v}` : "/admin/deals"} className={`rounded-full border px-3 py-1 text-sm ${(valid ?? "") === f.v ? "border-brand text-brand" : "border-line-strong"}`}>
            {f.label}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-line bg-canvas text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-3 py-2">Ưu đãi</th>
              <th className="px-3 py-2">Thẻ</th>
              <th className="px-3 py-2">Xác minh / xuất bản</th>
              <th className="px-3 py-2">Hiệu lực</th>
              <th className="px-3 py-2">Nguồn</th>
              <th className="px-3 py-2">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.id} className="border-b border-line align-top last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/admin/deals/${d.id}`} className="font-medium hover:text-brand">{d.title}</Link>
                  <p className="text-xs text-ink-muted">{d.merchant_name ?? d.category_name} · {d.import_key}</p>
                  <div className="mt-1 flex gap-1">
                    {d.is_demo && <Badge tone="warn">Demo</Badge>}
                    {d.is_featured && <Badge tone="info">Nổi bật</Badge>}
                    {d.stale && <Badge tone="warn">Xác minh cũ</Badge>}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">{d.card_names.join(", ") || <span className="text-brand">Chưa gắn thẻ</span>}</td>
                <td className="px-3 py-2 text-xs">
                  {d.verification_status} / {d.publication_status}
                  <p className="text-ink-muted">{LIFECYCLE_LABELS[d.lifecycle as DealLifecycle]}</p>
                </td>
                <td className="px-3 py-2 text-xs">{formatDate(d.start_date)} – {formatDate(d.end_date)}</td>
                <td className="px-3 py-2 text-xs">
                  {d.source_url ? (
                    <a href={d.source_url} target="_blank" rel="noopener noreferrer nofollow" className="text-brand hover:underline">Mở nguồn</a>
                  ) : "Không có"}
                  {!d.source_verified_at && d.source_url && <p className="text-warn">Nguồn chưa duyệt</p>}
                </td>
                <td className="space-y-1 px-3 py-2">
                  {d.publication_status !== "published" && d.verification_status === "verified" && (
                    <form action={setDealStatusAction}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="status" value="published" />
                      <button className="text-xs font-medium text-savings hover:underline">Xuất bản</button>
                    </form>
                  )}
                  {d.publication_status === "published" && (
                    <form action={setDealStatusAction}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="status" value="withdrawn" />
                      <button className="text-xs font-medium text-brand hover:underline">Ngừng hiển thị</button>
                    </form>
                  )}
                  <Link href={`/admin/deals/${d.id}`} className="block text-xs font-medium hover:underline">Sửa</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
