import Link from "next/link";
import { CategoryIcon } from "./category-icon";

export function CategoryChip({ slug, name, icon }: { slug: string; name: string; icon?: string | null }) {
  return (
    <Link href={`/so-sanh?category=${slug}`} className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-medium hover:border-brand hover:text-brand">
      <CategoryIcon icon={icon} className="size-4" />
      {name}
    </Link>
  );
}
