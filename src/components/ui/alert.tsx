import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  info: { cls: "bg-info-soft text-info border-blue-200", Icon: Info },
  warn: { cls: "bg-warn-soft text-warn border-amber-200", Icon: AlertTriangle },
  danger: { cls: "bg-brand-soft text-brand-hover border-red-200", Icon: AlertTriangle },
  success: { cls: "bg-savings-soft text-savings border-green-200", Icon: CheckCircle2 },
};

export function Alert({ tone = "info", title, children, className, role }: { tone?: keyof typeof tones; title?: string; children?: React.ReactNode; className?: string; role?: string }) {
  const { cls, Icon } = tones[tone];
  return (
    <div role={role ?? (tone === "danger" ? "alert" : "status")} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1 [&_p]:text-ink">
        {title && <p className="font-semibold !text-current">{title}</p>}
        {children}
      </div>
    </div>
  );
}
