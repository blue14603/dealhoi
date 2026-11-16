import Link from "next/link";
import type { MerchantRow } from "@/lib/services/catalog";
import { CategoryIcon } from "./category-icon";

export function MerchantCard({ merchant, offerCount }: { merchant: MerchantRow; offerCount?: number }) {
  return (
    <Link href={`/so-sanh?merchant=${merchant.slug}`} className="lift flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
      <span aria-hidden className="font-display grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg font-bold text-ice ring-1 ring-line-strong">
        {merchant.name.charAt(0)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{merchant.name}</span>
        <span className="flex items-center gap-1 text-xs text-ink-muted">
          <CategoryIcon icon={merchant.category.icon} className="size-3.5" />
          {merchant.category.name}
          {offerCount !== undefined && ` · ${offerCount > 0 ? `${offerCount} ưu đãi` : "chưa có ưu đãi"}`}
        </span>
      </span>
    </Link>
  );
}
