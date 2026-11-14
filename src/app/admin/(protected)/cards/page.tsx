import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { listAdminCards } from "@/lib/admin/admin-data";
import { requireAdmin } from "@/lib/admin/auth";
import { formatVnd } from "@/lib/domain/format";

export default async function AdminCards() {
  await requireAdmin();
  const cards = await listAdminCards();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Thẻ tín dụng ({cards.length})</h1>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {cards.map((c) => (
          <li key={String(c.id)} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
            <div>
              <Link href={`/admin/cards/${c.id}`} className="font-medium hover:text-brand">{String(c.name)}</Link>
              <p className="text-xs text-ink-muted">{String(c.bank_name)} · phí {c.annual_fee_vnd === null ? "chưa rõ" : formatVnd(Number(c.annual_fee_vnd))}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge tone={c.verification_status === "verified" ? "savings" : "warn"}>{String(c.verification_status)}</Badge>
              {!c.is_active && <Badge>Ngừng phát hành</Badge>}
              {c.is_featured && <Badge tone="info">Nổi bật</Badge>}
              {c.is_demo && <Badge tone="warn">Demo</Badge>}
              {!c.source_verified_at && <Badge tone="warn">Nguồn chưa duyệt</Badge>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
