"use client";
import { AlertTriangle, ExternalLink, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AI_UNAVAILABLE, NO_VERIFIED_DATA } from "@/lib/copy";

export interface SummaryData {
  summary: string;
  highlighted_benefits: string[];
  key_differences: string[];
  important_restrictions: string[];
  uncertainties: string[];
  sources: { id: string; url: string; publisher: string; isDemo: boolean }[];
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

export function SummaryView({ data }: { data: SummaryData }) {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed">{data.summary}</p>
      <List title="Điểm nổi bật" items={data.highlighted_benefits} />
      <List title="Khác biệt chính" items={data.key_differences} />
      <List title="Hạn chế quan trọng" items={data.important_restrictions} />
      <List title="Thông tin chưa rõ" items={data.uncertainties} />
      {data.sources.length > 0 && (
        <p className="flex flex-wrap gap-x-3 text-xs">
          <span className="font-medium">Nguồn:</span>
          {data.sources.map((s) => (
            <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-brand hover:underline">
              {s.isDemo ? "Nguồn minh họa" : s.publisher} <ExternalLink className="size-3" aria-hidden />
            </a>
          ))}
        </p>
      )}
      <p className="text-xs text-ink-subtle">Tóm tắt do AI viết từ dữ liệu đã xác minh. Số liệu trong bảng là nguồn chính xác.</p>
    </div>
  );
}

/** On-demand AI summary. The page remains fully usable if the AI service fails. */
export function AiSummary({ request, label = "Tóm tắt bằng AI" }: { request: Record<string, unknown>; label?: string }) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; data?: SummaryData; error?: string }>({ status: "idle" });

  async function run() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/summarize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request), signal: AbortSignal.timeout(45_000) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setState({ status: "error", error: data?.error?.code === "NO_VERIFIED_DATA" ? NO_VERIFIED_DATA : data?.error?.code === "RATE_LIMITED" ? data.error.message : AI_UNAVAILABLE });
        return;
      }
      setState({ status: "done", data });
    } catch {
      setState({ status: "error", error: AI_UNAVAILABLE });
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4" aria-live="polite">
      {state.status === "idle" && (
        <Button variant="soft" onClick={run}>
          <Sparkles aria-hidden /> {label}
        </Button>
      )}
      {state.status === "loading" && (
        <p className="flex items-center gap-2 text-sm text-ink-muted" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Đang tóm tắt từ dữ liệu đã xác minh…
        </p>
      )}
      {state.status === "error" && (
        <div role="alert" className="text-sm">
          <p className="flex items-center gap-2 text-brand-hover">
            <AlertTriangle className="size-4" aria-hidden /> {state.error}
          </p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={run}>
            <RotateCcw aria-hidden /> Thử lại
          </Button>
        </div>
      )}
      {state.status === "done" && state.data && <SummaryView data={state.data} />}
    </div>
  );
}
