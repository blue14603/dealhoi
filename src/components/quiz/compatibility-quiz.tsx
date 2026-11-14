"use client";
import { Loader2, Lock, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AI_UNAVAILABLE } from "@/lib/copy";
import type { CompatibilityResult as Result } from "@/lib/domain/compatibility";
import { formatNumber, parseVndInput } from "@/lib/domain/format";
import { FEE_PREFERENCES, REPAYMENT_OPTIONS, REWARD_PREFERENCES, SPEND_RANGES, type QuizAnswers } from "@/lib/domain/quiz";
import { cn } from "@/lib/utils";
import type { SummaryData } from "@/components/ai/ai-summary";
import { CompatibilityResultView } from "./compatibility-result";

const STORAGE_KEY = "dealhoi-quiz-answers-v1";

type Draft = Partial<Omit<QuizAnswers, "categorySpend">> & { categories: string[]; categorySpendRaw: Record<string, string> };

const emptyDraft: Draft = { categories: [], categorySpendRaw: {} };

function Choice({ name, value, checked, onChange, label, type = "radio" }: { name: string; value: string; checked: boolean; onChange: () => void; label: string; type?: "radio" | "checkbox" }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors", checked ? "border-brand bg-brand-soft" : "border-line-strong bg-surface hover:border-ink-subtle")}>
      <input type={type} name={name} value={value} checked={checked} onChange={onChange} className="size-4 accent-[var(--color-brand)]" />
      {label}
    </label>
  );
}

function Step({ n, title, hint, children, error }: { n: number; title: string; hint?: string; children: React.ReactNode; error?: string }) {
  return (
    <fieldset className="rounded-2xl border border-line bg-surface p-5" aria-invalid={error ? true : undefined}>
      <legend className="sr-only">{title}</legend>
      <p aria-hidden className="text-base font-semibold">
        <span className="mr-2 text-brand">{n}.</span>
        {title}
      </p>
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-brand-hover">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function CompatibilityQuiz({ cardSlug, cardName, categories }: { cardSlug: string; cardName: string; categories: { slug: string; name: string }[] }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; result?: Result; message?: string }>({ status: "idle" });
  const [explain, setExplain] = useState<{ status: "idle" | "loading" | "done" | "error"; data?: SummaryData; message?: string }>({ status: "idle" });
  const resultRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDraft({ ...emptyDraft, ...(JSON.parse(raw) as Draft) });
    } catch {
      /* storage unavailable */
    }
  }, []);

  function update(patch: Partial<Draft>) {
    setDraft((d) => {
      const next = { ...d, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function clearAnswers() {
    setDraft(emptyDraft);
    setState({ status: "idle" });
    setExplain({ status: "idle" });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function buildAnswers(): QuizAnswers | null {
    const e: Record<string, string> = {};
    if (!draft.monthlySpend) e.monthlySpend = "Vui lòng chọn mức chi tiêu.";
    if (!draft.categories.length) e.categories = "Vui lòng chọn ít nhất một danh mục.";
    const categorySpend: Record<string, number> = {};
    for (const slug of draft.categories) {
      const raw = draft.categorySpendRaw[slug]?.trim();
      if (!raw) continue;
      const v = parseVndInput(raw);
      if (v === null) e[`spend-${slug}`] = "Số tiền không hợp lệ.";
      else categorySpend[slug] = v;
    }
    if (!draft.rewardPreference) e.rewardPreference = "Vui lòng chọn loại ưu đãi.";
    if (!draft.feePreference) e.feePreference = "Vui lòng chọn mức phí.";
    if (!draft.repayment) e.repayment = "Vui lòng chọn một phương án.";
    setErrors(e);
    if (Object.keys(e).length) return null;
    return {
      monthlySpend: draft.monthlySpend!,
      categories: draft.categories,
      categorySpend,
      rewardPreference: draft.rewardPreference!,
      feePreference: draft.feePreference!,
      repayment: draft.repayment!,
    };
  }

  async function post(answers: QuizAnswers, withExplanation: boolean) {
    const res = await fetch("/api/quiz", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardSlug, answers, explain: withExplanation }),
      signal: AbortSignal.timeout(45_000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error?.message ?? "Không thể tính kết quả.");
    return data as { result: Result; explanation: SummaryData | null; explanationError: string | null };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const answers = buildAnswers();
    if (!answers) return;
    setState({ status: "loading" });
    setExplain({ status: "idle" });
    try {
      const data = await post(answers, false);
      setState({ status: "done", result: data.result });
      setTimeout(() => resultRef.current?.focus(), 50);
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Không thể tính kết quả." });
    }
  }

  async function requestExplanation() {
    const answers = buildAnswers();
    if (!answers) return;
    setExplain({ status: "loading" });
    try {
      const data = await post(answers, true);
      if (data.explanation) setExplain({ status: "done", data: data.explanation });
      else setExplain({ status: "error", message: data.explanationError ?? AI_UNAVAILABLE });
    } catch {
      setExplain({ status: "error", message: AI_UNAVAILABLE });
    }
  }

  const toggleCategory = (slug: string) =>
    update({ categories: draft.categories.includes(slug) ? draft.categories.filter((c) => c !== slug) : [...draft.categories, slug] });

  return (
    <div className="space-y-6">
      <Alert tone="info" title="Không cần thông tin nhạy cảm">
        <p>
          DealHoi không hỏi số thẻ, tài khoản ngân hàng, giấy tờ tùy thân, thu nhập chính xác hay lịch sử tín dụng. Câu trả lời chỉ được lưu trên trình duyệt của bạn.
        </p>
      </Alert>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Step n={1} title="Mỗi tháng bạn chi tiêu khoảng bao nhiêu bằng thẻ?" error={errors.monthlySpend}>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(SPEND_RANGES).map(([k, v]) => (
              <Choice key={k} name={`${id}-spend`} value={k} label={v.label} checked={draft.monthlySpend === k} onChange={() => update({ monthlySpend: k as QuizAnswers["monthlySpend"] })} />
            ))}
          </div>
        </Step>
        <Step n={2} title="Bạn chi tiêu chủ yếu cho những gì?" hint="Chọn một hoặc nhiều danh mục." error={errors.categories}>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((c) => (
              <Choice key={c.slug} type="checkbox" name={`${id}-cat`} value={c.slug} label={c.name} checked={draft.categories.includes(c.slug)} onChange={() => toggleCategory(c.slug)} />
            ))}
          </div>
        </Step>
        {draft.categories.length > 0 && (
          <Step n={3} title="Ước tính chi tiêu mỗi tháng cho từng danh mục (không bắt buộc)" hint="Giúp đánh giá chính xác hơn các điều kiện chi tiêu tối thiểu.">
            <div className="grid gap-3 sm:grid-cols-2">
              {draft.categories.map((slug) => {
                const name = categories.find((c) => c.slug === slug)?.name ?? slug;
                const err = errors[`spend-${slug}`];
                return (
                  <div key={slug}>
                    <label htmlFor={`${id}-sp-${slug}`} className="mb-1.5 block text-sm font-medium">
                      {name} (VND/tháng)
                    </label>
                    <Input
                      id={`${id}-sp-${slug}`}
                      inputMode="numeric"
                      placeholder="Ví dụ: 1.000.000"
                      value={draft.categorySpendRaw[slug] ?? ""}
                      onChange={(e) => update({ categorySpendRaw: { ...draft.categorySpendRaw, [slug]: e.target.value } })}
                      onBlur={(e) => {
                        const v = parseVndInput(e.target.value);
                        if (v !== null) update({ categorySpendRaw: { ...draft.categorySpendRaw, [slug]: formatNumber(v) } });
                      }}
                      aria-invalid={err ? true : undefined}
                    />
                    {err && <p className="mt-1 text-xs text-brand-hover">{err}</p>}
                  </div>
                );
              })}
            </div>
          </Step>
        )}
        <Step n={4} title="Bạn thích loại ưu đãi nào nhất?" error={errors.rewardPreference}>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(REWARD_PREFERENCES).map(([k, v]) => (
              <Choice key={k} name={`${id}-reward`} value={k} label={v} checked={draft.rewardPreference === k} onChange={() => update({ rewardPreference: k as QuizAnswers["rewardPreference"] })} />
            ))}
          </div>
        </Step>
        <Step n={5} title="Bạn chấp nhận phí thường niên ở mức nào?" error={errors.feePreference}>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(FEE_PREFERENCES).map(([k, v]) => (
              <Choice key={k} name={`${id}-fee`} value={k} label={v.label} checked={draft.feePreference === k} onChange={() => update({ feePreference: k as QuizAnswers["feePreference"] })} />
            ))}
          </div>
        </Step>
        <Step n={6} title="Bạn dự định thanh toán dư nợ thẻ như thế nào?" error={errors.repayment}>
          <div className="grid gap-2">
            {Object.entries(REPAYMENT_OPTIONS).map(([k, v]) => (
              <Choice key={k} name={`${id}-repay`} value={k} label={v} checked={draft.repayment === k} onChange={() => update({ repayment: k as QuizAnswers["repayment"] })} />
            ))}
          </div>
        </Step>
        {Object.keys(errors).length > 0 && (
          <p role="alert" className="text-sm font-medium text-brand-hover">
            Vui lòng hoàn thành các câu hỏi được đánh dấu.
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={state.status === "loading"}>
            {state.status === "loading" && <Loader2 className="animate-spin" aria-hidden />}
            Xem mức độ phù hợp với {cardName}
          </Button>
          <Button type="button" variant="ghost" size="lg" onClick={clearAnswers}>
            <Trash2 aria-hidden /> Xóa câu trả lời
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
          <Lock className="size-3.5" aria-hidden /> Điểm được tính bằng quy tắc cố định, không phải bằng AI.
        </p>
      </form>

      <div ref={resultRef} tabIndex={-1} aria-live="polite" className="focus:outline-none">
        {state.status === "error" && (
          <Alert tone="danger" title="Không thể tính kết quả">
            <p>{state.message}</p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={(e) => submit(e as unknown as React.FormEvent)}>
              <RotateCcw aria-hidden /> Thử lại
            </Button>
          </Alert>
        )}
        {state.status === "done" && state.result && (
          <CompatibilityResultView result={state.result} cardName={cardName} explanation={explain} onExplain={requestExplanation} />
        )}
      </div>
    </div>
  );
}
