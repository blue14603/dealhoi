import Link from "next/link";

/** One-line reminder of what to do on an admin page, with a link to the matching guide section. */
export function PageHint({ children, guide }: { children: React.ReactNode; guide: string }) {
  return (
    <p className="rounded-xl border border-line bg-surface px-4 py-2 text-sm text-ink-muted">
      {children}{" "}
      <Link href={`/admin/huong-dan#${guide}`} className="font-medium text-brand hover:underline">
        Xem hướng dẫn
      </Link>
    </p>
  );
}
