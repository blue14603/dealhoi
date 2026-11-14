import type * as React from "react";
import { Button } from "@/components/ui/button";

/** Plain GET form: works without JavaScript, keeps filters in the URL. */
export function FilterForm({ action, children, resetHref }: { action: string; children: React.ReactNode; resetHref: string }) {
  return (
    <form action={action} method="get" className="rounded-2xl border border-line bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit">Áp dụng bộ lọc</Button>
        <Button asChild variant="ghost">
          <a href={resetHref}>Xóa bộ lọc</a>
        </Button>
      </div>
    </form>
  );
}
