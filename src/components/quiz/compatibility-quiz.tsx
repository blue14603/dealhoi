"use client";
import { ArrowLeft, ArrowRight, Loader2, Lock, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { SummaryData } from "@/components/ai/ai-summary";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_ART } from "@/config/discovery";
import { AI_UNAVAILABLE } from "@/lib/copy";
import type { CompatibilityResult as Result } from "@/lib/domain/compatibility";
import { formatNumber, parseVndInput } from "@/lib/domain/format";
import { FEE_PREFERENCES, REPAYMENT_OPTIONS, REWARD_PREFERENCES, SPEND_RANGES, type QuizAnswers } from "@/lib/domain/quiz";
import { cn } from "@/lib/utils";
import { CompatibilityResultView } from "./compatibility-result";

const STORAGE_KEY = "dealhoi-quiz-answers-v1";

type Draft = Partial<Omit<QuizAnswers, "categorySpend">> & { categories: string[]; categorySpendRaw: Record<string, string> };
const emptyDraft: Draft = { categories: [], categorySpendRaw: {} };

type StepKey = "monthlySpend" | "categories" | "categorySpend" | "rewardPreference" | "feePreference" | "repayment";

const STEPS: { key: StepKey; title: string; hint?: string; optional?: boolean }[] = [
  { key: "monthlySpend", title: "Mỗi tháng bạn chi khoảng bao nhiêu bằng thẻ?", hint: "Ước lượng là đủ, không cần chính xác." },
  { key: "categories", title: "Bạn hay chi cho những gì?", hint: "Chọn một hoặc nhiều mục." },
  { key: "categorySpend", title: "Mỗi mục khoảng bao nhiêu một tháng?", hint: "Không bắt buộc — giúp đánh giá chính xác hơn các điều kiện chi tiêu tối thiểu.", optional: true },
  { key: "rewardPreference", title: "Kiểu ưu đãi nào làm bạn thấy “hời” nhất?" },
  { key: "feePreference", title: "Bạn chấp nhận phí thường niên ở mức nào?" },
  { key: "repayment", title: "Bạn định thanh toán dư nợ thẻ thế nào?", hint: "Câu trả lời không làm thay đổi điểm, nhưng giúp DealHoi nhắc bạn về lãi và phí nếu cần." },
];

function Choice({
  name,
  value,
  checked,
  onChange,
  label,
  type = "radio",
  art,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  type?: "radio" | "checkbox";
  art?: string;
}) {
  return (
    <label
      className={cn(
        "relative flex min-h-16 cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3.5 text-base transition-colors duration-200",
        checked ? "border-brand-bright bg-brand-soft text-ink" : "border-line-strong bg-surface-2 text-ink-muted hover:border-ink-subtle hover:text-ink",
        art && "min-h-24 pr-24",
      )}
    >
      <input type={type} name={name} value={value} checked={checked} onChange={onChange} className="size-5 shrink-0 accent-[var(--color-brand)]" />
      <span className="font-medium">{label}</span>
      {art && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={art} alt="" aria-hidden width={80} height={80} className="pointer-events-none absolute top-1/2 right-2 h-16 w-auto -translate-y-1/2" />
      )}
    </label>
  );
}

export function CompatibilityQuiz({ cardSlug, cardName, categories }: { cardSlug: string; cardName: string; categories: { slug: string; name: string; icon?: string | null }[] }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; result?: Result; message?: string }>({ status: "idle" });
  const [explain, setExplain] = useState<{ status: "idle" | "loading" | "done" | "error"; data?: SummaryData; message?: string }>({ status: "idle" });
  const resultRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLLegendElement>(null);
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
    setStepError(null);
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
    setStep(0);
    setState({ status: "idle" });
    setExplain({ status: "idle" });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  /** Validation for a single step; returns an error message or null. */
  function validateStep(key: StepKey): string | null {
    switch (key) {
      case "monthlySpend":
        return draft.monthlySpend ? null : "Vui lòng chọn mức chi tiêu.";
      case "categories":
        return draft.categories.length ? null : "Vui lòng chọn ít nhất một mục.";
      case "categorySpend": {
        const bad = draft.categories.find((s) => draft.categorySpendRaw[s]?.trim() && parseVndInput(draft.categorySpendRaw[s]) === null);
        return bad ? "Có số tiền chưa hợp lệ. Chỉ nhập chữ số, ví dụ 1.000.000." : null;
      }
      case "rewardPreference":
        return draft.rewardPreference ? null : "Vui lòng chọn một kiểu ưu đãi.";
      case "feePreference":
        return draft.feePreference ? null : "Vui lòng chọn mức phí.";
      case "repayment":
        return draft.repayment ? null : "Vui lòng chọn một phương án.";
    }
  }

  function buildAnswers(): QuizAnswers | null {
    for (const s of STEPS) {
      const err = validateStep(s.key);
      if (err) {
        setStep(STEPS.indexOf(s));
        setStepError(err);
        return null;
      }
    }
    const categorySpend: Record<string, number> = {};
    for (const slug of draft.categories) {
      const v = draft.categorySpendRaw[slug]?.trim() ? parseVndInput(draft.categorySpendRaw[slug]) : null;
      if (v !== null) categorySpend[slug] = v;
    }
    return {
      monthlySpend: draft.monthlySpend!,
      categories: draft.categories,
      categorySpend,
      rewardPreference: draft.rewardPreference!,
      feePreference: draft.feePreference!,
      repayment: draft.repayment!,
    };
  }

  function go(to: number) {
    setStepError(null);
    setStep(to);
    setTimeout(() => headingRef.current?.focus(), 30);
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

  async function submit() {
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

  function next() {
    const err = validateStep(STEPS[step].key);
    if (err) {
      setStepError(err);
      return;
    }
    if (step === STEPS.length - 1) void submit();
    else go(step + 1);
  }

  const toggleCategory = (slug: string) =>
    update({ categories: draft.categories.includes(slug) ? draft.categories.filter((c) => c !== slug) : [...draft.categories, slug] });

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="space-y-8">
      <Alert tone="info" title="Không cần thông tin nhạy cảm">
        <p>DealHoi không hỏi số thẻ, tài khoản ngân hàng, giấy tờ tùy thân, thu nhập chính xác hay lịch sử tín dụng. Câu trả lời chỉ được lưu trên trình duyệt của bạn.</p>
      </Alert>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
        noValidate
        className="rounded-3xl border border-line bg-surface p-5 sm:p-8"
      >
        {/* Progress */}
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="eyebrow">
            Bước <span className="font-display text-ice tabular">{step + 1}</span> / {STEPS.length}
          </span>
          {current.optional && <span className="text-xs text-ink-subtle">Không bắt buộc</span>}
        </div>
        <div
          className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="Tiến độ trả lời"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
        >
          <div className="h-full rounded-full bg-brand-bright transition-[width] duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>

        <fieldset key={current.key} className="step-in mt-8" aria-describedby={stepError ? `${id}-err` : undefined}>
          <legend ref={headingRef} tabIndex={-1} className="font-display text-[1.75rem] leading-tight font-bold focus:outline-none sm:text-[2.25rem]">
            {current.title}
          </legend>
          {current.hint && <p className="mt-2 text-sm text-ink-muted">{current.hint}</p>}

          <div className="mt-6">
            {current.key === "monthlySpend" && (
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(SPEND_RANGES).map(([k, v]) => (
                  <Choice key={k} name={`${id}-spend`} value={k} label={v.label} checked={draft.monthlySpend === k} onChange={() => update({ monthlySpend: k as QuizAnswers["monthlySpend"] })} />
                ))}
              </div>
            )}
            {current.key === "categories" && (
              <div className="grid gap-3 sm:grid-cols-2">
                {categories.map((c) => (
                  <Choice
                    key={c.slug}
                    type="checkbox"
                    name={`${id}-cat`}
                    value={c.slug}
                    label={c.name}
                    art={c.icon ? CATEGORY_ART[c.icon] : undefined}
                    checked={draft.categories.includes(c.slug)}
                    onChange={() => toggleCategory(c.slug)}
                  />
                ))}
              </div>
            )}
            {current.key === "categorySpend" &&
              (draft.categories.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {draft.categories.map((slug) => {
                    const name = categories.find((c) => c.slug === slug)?.name ?? slug;
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
                          aria-invalid={draft.categorySpendRaw[slug]?.trim() && parseVndInput(draft.categorySpendRaw[slug]) === null ? true : undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-ink-muted">Hãy chọn danh mục ở bước trước.</p>
              ))}
            {current.key === "rewardPreference" && (
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(REWARD_PREFERENCES).map(([k, v]) => (
                  <Choice key={k} name={`${id}-reward`} value={k} label={v} checked={draft.rewardPreference === k} onChange={() => update({ rewardPreference: k as QuizAnswers["rewardPreference"] })} />
                ))}
              </div>
            )}
            {current.key === "feePreference" && (
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(FEE_PREFERENCES).map(([k, v]) => (
                  <Choice key={k} name={`${id}-fee`} value={k} label={v.label} checked={draft.feePreference === k} onChange={() => update({ feePreference: k as QuizAnswers["feePreference"] })} />
                ))}
              </div>
            )}
            {current.key === "repayment" && (
              <div className="grid gap-3">
                {Object.entries(REPAYMENT_OPTIONS).map(([k, v]) => (
                  <Choice key={k} name={`${id}-repay`} value={k} label={v} checked={draft.repayment === k} onChange={() => update({ repayment: k as QuizAnswers["repayment"] })} />
                ))}
              </div>
            )}
          </div>
          {stepError && (
            <p id={`${id}-err`} role="alert" className="mt-4 text-sm font-medium text-danger">
              {stepError}
            </p>
          )}
        </fieldset>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="secondary" size="lg" onClick={() => go(step - 1)}>
                <ArrowLeft aria-hidden /> Quay lại
              </Button>
            )}
            <Button type="button" variant="ghost" size="lg" onClick={clearAnswers}>
              <Trash2 aria-hidden /> Xóa câu trả lời
            </Button>
          </div>
          <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={state.status === "loading"}>
            {state.status === "loading" && <Loader2 className="animate-spin" aria-hidden />}
            {isLast ? `Xem mức độ phù hợp với ${cardName}` : current.optional ? "Tiếp tục" : "Tiếp theo"}
            {!isLast && <ArrowRight aria-hidden />}
          </Button>
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-subtle">
          <Lock className="size-3.5" aria-hidden /> Điểm được tính bằng quy tắc cố định, không phải bằng AI.
        </p>
      </form>

      <div ref={resultRef} tabIndex={-1} aria-live="polite" className="focus:outline-none">
        {state.status === "error" && (
          <Alert tone="danger" title="Không thể tính kết quả">
            <p>{state.message}</p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => void submit()}>
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
