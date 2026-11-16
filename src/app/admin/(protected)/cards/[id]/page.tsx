import Link from "next/link";
import { notFound } from "next/navigation";
import { CardEditForm } from "@/components/admin/card-edit-form";
import { getAdminCard } from "@/lib/admin/admin-data";
import { requireAdmin } from "@/lib/admin/auth";

export default async function EditCard({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const card = await getAdminCard(id);
  if (!card) notFound();
  const plain = Object.fromEntries(Object.entries(card).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : (v as string | number | boolean | null)]));
  return (
    <div className="space-y-6">
      <Link href="/admin/cards" className="text-sm text-ink-muted hover:text-accent">← Danh sách thẻ</Link>
      <div>
        <h1 className="text-2xl font-bold">{String(card.name)}</h1>
        <p className="mt-1 text-sm">
          Nguồn:{" "}
          {card.source_url ? (
            <a className="text-accent hover:underline" href={String(card.source_url)} target="_blank" rel="noopener noreferrer nofollow">{String(card.source_url)}</a>
          ) : "không có"}
        </p>
      </div>
      <CardEditForm id={id} card={plain} />
    </div>
  );
}
