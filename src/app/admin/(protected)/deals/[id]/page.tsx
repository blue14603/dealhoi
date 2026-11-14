import Link from "next/link";
import { notFound } from "next/navigation";
import { DealEditForm } from "@/components/admin/deal-edit-form";
import { getAdminDeal } from "@/lib/admin/admin-data";
import { requireAdmin } from "@/lib/admin/auth";

export default async function EditDeal({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await getAdminDeal(id);
  if (!data) notFound();
  const { deal, cards } = data;
  const plain = Object.fromEntries(Object.entries(deal).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : (v as string | number | boolean | null)]));
  return (
    <div className="space-y-6">
      <Link href="/admin/deals" className="text-sm text-ink-muted hover:text-brand">← Danh sách ưu đãi</Link>
      <div>
        <h1 className="text-2xl font-bold">{String(deal.title)}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {String(deal.benefit_type)} · {String(deal.offer_type)} · {String(deal.merchant_scope)} · khóa nhập: {String(deal.import_key ?? "—")}
        </p>
        <p className="mt-1 text-sm">
          Nguồn:{" "}
          {deal.source_url ? (
            <a className="text-brand hover:underline" href={String(deal.source_url)} target="_blank" rel="noopener noreferrer nofollow">{String(deal.source_url)}</a>
          ) : "không có"}
          {deal.source_url && !deal.source_verified_at && <span className="text-warn"> (chưa duyệt — <Link href="/admin/sources" className="underline">duyệt nguồn</Link>)</span>}
        </p>
        <p className="mt-1 text-sm">Thẻ đủ điều kiện: {cards.map((c) => String(c.name)).join(", ") || "chưa có (cần nhập lại với card_slugs)"}</p>
      </div>
      <DealEditForm id={id} deal={plain} />
    </div>
  );
}
