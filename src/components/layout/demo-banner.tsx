import { FlaskConical } from "lucide-react";
import { DEMO_NOTICE } from "@/lib/copy";

export function DemoBanner() {
  return (
    <div role="note" className="border-b border-amber-200 bg-warn-soft">
      <p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 text-xs font-medium text-warn sm:px-6 sm:text-sm">
        <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
        {DEMO_NOTICE}
      </p>
    </div>
  );
}
