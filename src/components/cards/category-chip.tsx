import Link from "next/link";
import { CATEGORY_ART } from "@/config/discovery";
import { CategoryIcon } from "./category-icon";

/** Compact category control (used on search and empty states). */
export function CategoryChip({ slug, name, icon }: { slug: string; name: string; icon?: string | null }) {
  return (
    <Link
      href={`/so-sanh?category=${slug}`}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition-colors duration-200 hover:border-brand-bright hover:text-ink"
    >
      <CategoryIcon icon={icon} className="size-4 text-ice" />
      {name}
    </Link>
  );
}

/** Lifestyle discovery tile with an original illustration. */
export function CategoryTile({ slug, name, icon, offerCount }: { slug: string; name: string; icon?: string | null; offerCount?: number }) {
  const art = icon ? CATEGORY_ART[icon] : undefined;
  return (
    <Link
      href={`/so-sanh?category=${slug}`}
      className="lift group relative flex h-44 flex-col justify-end overflow-hidden rounded-2xl border border-line bg-surface p-4"
    >
      {art && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={art} alt="" aria-hidden width={120} height={120} loading="lazy" className="lift-asset pointer-events-none absolute top-2 right-1 h-[76px] w-auto opacity-95 sm:-top-1 sm:-right-2 sm:h-24" />
      )}
      <span className="font-display relative text-lg leading-tight font-bold">{name}</span>
      {offerCount !== undefined && (
        <span className="relative mt-1 text-xs text-ink-muted">{offerCount > 0 ? `${offerCount} ưu đãi đang áp dụng` : "Chưa có ưu đãi đã xác minh"}</span>
      )}
    </Link>
  );
}
