"use client";
import { AlertTriangle, CheckCircle2, Loader2, MinusCircle, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { SummaryView, type SummaryData } from "@/components/ai/ai-summary";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CompatibilityResult } from "@/lib/domain/compatibility";
import { cn } from "@/lib/utils";

function ScoreRing({ score }: { score: number | null }) {
  const pct = score ?? 0;
  const tone = score === null ? "text-ink-subtle" : score >= 70 ? "text-ice" : score >= 40 ? "text-chrome" : "text-warn";
  return (
    <div className="relative grid size-40 shrink-0 place-items-center sm:size-48" role="img" aria-label={score === null ? "Chưa thể tính điểm" : `Điểm phù hợp ${score} trên 100`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/10" />
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${pct} 100`} strokeLinecap="round" className={tone} />
      </svg>
      <span className={cn("font-display text-6xl leading-none font-bold tracking-[-0.05em] tabular sm:text-7xl", tone)}>{score ?? "—"}</span>
    </div>
  );
}

const RELIABILITY = {
  reliable: { label: "Đủ dữ liệu", tone: "savings" },
  provisional: { label: "Điểm tạm tính", tone: "warn" },
  insufficient: { label: "Chưa đủ dữ liệu", tone: "neutral" },
} as const;

export function CompatibilityResultView({
  result,
  cardName,
  explanation,
  onExplain,
}: {
  result: CompatibilityResult;
  cardName: string;
  explanation: { status: "idle" | "loading" | "done" | "error"; data?: SummaryData; message?: string };
  onExplain: () => void;
}) {
  const rel = RELIABILITY[result.reliability];
  return (
    <section aria-labelledby="h-result" className="space-y-8 rounded-3xl border border-line bg-[linear-gradient(160deg,#131c3d_0%,#141720_40%)] p-5 sm:p-8" data-testid="compatibility-result">
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <ScoreRing score={result.score} />
        <div>
          <p className="eyebrow">Compatibility · Mức độ phù hợp</p>
          <h2 id="h-result" className="font-display mt-3 text-[1.75rem] leading-tight font-bold sm:text-[2.25rem]">
            {cardName}
          </h2>
          <Badge tone={rel.tone} className="mt-2">
            {rel.label}
          </Badge>
          <p className="mt-2 text-sm text-ink-muted">{result.reliabilityExplanation}</p>
        </div>
      </div>

      {result.balanceWarning && (
        <Alert tone="danger" title="Lưu ý về dư nợ thẻ tín dụng">
          <p>{result.balanceWarning}</p>
        </Alert>
      )}

      <div>
        <h3 className="font-display mb-3 text-xl font-bold">Cách tính điểm</h3>
        <ul className="space-y-3">
          {result.dimensions.map((d) => (
            <li key={d.key} className="rounded-2xl border border-line bg-surface/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {d.label} <span className="text-xs font-normal text-ink-subtle">· trọng số {d.weight}%</span>
                </p>
                <span className="text-sm font-semibold tabular">
                  {d.status === "scored" ? `${d.score}/100` : d.status === "not_applicable" ? "Không tính" : "Thiếu dữ liệu"}
                </span>
              </div>
              {d.status === "scored" && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#2457ff,#a9c7ff)]" style={{ width: `${d.score}%` }} />
                </div>
              )}
              <p className="mt-2 text-sm text-ink-muted">{d.explanation}</p>
              {d.details.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-xs text-ink-muted">
                  {d.details.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="font-display mb-2 text-lg font-bold">Lý do có thể phù hợp</h3>
          {result.reasons.length ? (
            <ul className="space-y-1.5 text-sm">
              {result.reasons.map((r) => (
                <li key={r} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-savings" aria-hidden /> {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Không tìm thấy điểm phù hợp rõ ràng.</p>
          )}
        </div>
        <div>
          <h3 className="font-display mb-2 text-lg font-bold">Hạn chế & bất lợi</h3>
          {result.drawbacks.length ? (
            <ul className="space-y-1.5 text-sm">
              {result.drawbacks.map((r) => (
                <li key={r} className="flex gap-2">
                  <XCircle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /> {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Không phát hiện hạn chế đáng kể từ dữ liệu hiện có.</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-display mb-2 text-lg font-bold">Quyền lợi bạn có thể dùng thực tế</h3>
        {result.usableBenefits.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {result.usableBenefits.map((b) => (
              <li key={b.dealId} className="rounded-xl bg-canvas p-3 text-sm">
                <p className="font-medium">{b.title}</p>
                <p className="text-xs text-ink-muted">
                  {b.categoryName} · {b.why}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">Chưa có quyền lợi đã xác minh khớp với danh mục bạn chọn.</p>
        )}
      </div>

      {result.blockingConditions.length > 0 && (
        <div>
          <h3 className="font-display mb-2 text-lg font-bold">Điều kiện có thể khiến bạn không nhận được ưu đãi</h3>
          <ul className="space-y-1.5 text-sm">
            {result.blockingConditions.map((r) => (
              <li key={r} className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden /> {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-line p-4">
        {explanation.status === "idle" && (
          <Button variant="soft" onClick={onExplain}>
            <Sparkles aria-hidden /> Giải thích kết quả bằng AI
          </Button>
        )}
        {explanation.status === "loading" && (
          <p className="flex items-center gap-2 text-sm text-ink-muted" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Đang viết giải thích…
          </p>
        )}
        {explanation.status === "error" && (
          <div role="alert" className="text-sm text-danger">
            <p>{explanation.message}</p>
            <Button variant="secondary" size="sm" className="mt-2" onClick={onExplain}>
              <RotateCcw aria-hidden /> Thử lại
            </Button>
          </div>
        )}
        {explanation.status === "done" && explanation.data && <SummaryView data={explanation.data} />}
        <p className="mt-2 text-xs text-ink-subtle">AI chỉ giải thích; điểm số không thay đổi.</p>
      </div>

      <p className="flex gap-2 text-xs text-ink-muted">
        <MinusCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {result.disclaimer}
      </p>
    </section>
  );
}
