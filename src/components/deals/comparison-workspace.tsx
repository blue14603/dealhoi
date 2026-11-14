"use client";
import { Info, RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { AiSummary } from "@/components/ai/ai-summary";
import { ChatPanel } from "@/components/chat/chat-panel";
import { EmptyState } from "@/components/common/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { NO_VERIFIED_DATA } from "@/lib/copy";
import { BENEFIT_TYPE_LABELS, CHANNEL_LABELS, formatNumber, formatVnd, parseVndInput } from "@/lib/domain/format";
import { calculateSavings, compareDeals } from "@/lib/domain/savings";
import type { BenefitType, DealRecord, PaymentChannel } from "@/lib/domain/types";
import { ComparisonTable, OtherBenefitsList, type ComparisonRow } from "./comparison-table";

const MAX_AMOUNT = 100_000_000_000;

interface Props {
  activeDeals: DealRecord[];
  inactiveDeals: DealRecord[];
  today: string;
  staleAfterDays: number;
  target: { kind: "merchant" | "category"; slug: string; name: string; merchantId: string | null };
  initialAmount: number | null;
}

export function ComparisonWorkspace({ activeDeals, inactiveDeals, today, staleAfterDays, target, initialAmount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const amountId = useId();
  const [raw, setRaw] = useState(initialAmount ? formatNumber(initialAmount) : "");
  const [bank, setBank] = useState("");
  const [type, setType] = useState<BenefitType | "">("");
  const [channel, setChannel] = useState<PaymentChannel | "">("");

  const parsedAmount = raw.trim() ? parseVndInput(raw) : null;
  const amountError =
    raw.trim() && parsedAmount === null ? "Vui lòng nhập số tiền hợp lệ (chỉ gồm chữ số), ví dụ 150.000." : parsedAmount !== null && parsedAmount > MAX_AMOUNT ? "Số tiền quá lớn." : parsedAmount === 0 ? "Số tiền phải lớn hơn 0." : null;
  const amount = amountError ? null : parsedAmount;

  // Keep the amount in the URL so the comparison can be shared or refreshed.
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (amount) params.set("amount", String(amount));
      else params.delete("amount");
      const next = `${pathname}?${params.toString()}`;
      if (next !== `${pathname}?${searchParams.toString()}`) router.replace(next, { scroll: false });
    }, 400);
    return () => clearTimeout(t);
  }, [amount, pathname, router, searchParams]);

  const banks = useMemo(() => [...new Map(activeDeals.flatMap((d) => d.cards.map((c) => [c.bankSlug, c.bankName] as const))).entries()], [activeDeals]);
  const types = useMemo(() => [...new Set(activeDeals.map((d) => d.benefitType))], [activeDeals]);

  const filtered = useMemo(
    () =>
      activeDeals.filter(
        (d) =>
          (!bank || d.cards.some((c) => c.bankSlug === bank)) &&
          (!type || d.benefitType === type) &&
          (!channel || d.paymentChannel === channel || (d.paymentChannel === "both" && channel !== "unknown")),
      ),
    [activeDeals, bank, type, channel],
  );

  const ctx = { amountVnd: amount, today, merchantId: target.merchantId, merchantName: target.kind === "merchant" ? target.name : null };
  const outcome = useMemo(() => compareDeals(filtered, ctx), [filtered, amount, today, target.merchantId]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = new Map(filtered.map((d) => [d.id, d]));
  const rows: ComparisonRow[] = outcome.results.map((r) => ({ deal: byId.get(r.dealId)!, result: r }));
  const monetary = rows.filter((r) => r.result.group === "monetary");
  const installments = rows.filter((r) => r.result.group === "installment");
  const others = rows.filter((r) => r.result.group === "other");
  const best = monetary.filter((r) => r.result.isBest);
  const filtersActive = bank || type || channel;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
      <div className="min-w-0 space-y-8">
        <div className="z-10 rounded-2xl border border-line bg-surface p-4 lg:sticky lg:top-20">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Label htmlFor={amountId}>Số tiền bạn dự định chi (VND)</Label>
              <Input
                id={amountId}
                inputMode="numeric"
                placeholder="Ví dụ: 150.000"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                onBlur={() => amount && setRaw(formatNumber(amount))}
                aria-invalid={amountError ? true : undefined}
                aria-describedby={amountError ? `${amountId}-err` : `${amountId}-hint`}
              />
              {amountError ? (
                <p id={`${amountId}-err`} role="alert" className="mt-1 text-xs text-brand-hover">
                  {amountError}
                </p>
              ) : (
                <p id={`${amountId}-hint`} className="mt-1 text-xs text-ink-subtle">
                  Không bắt buộc. Dùng để ước tính số tiền tiết kiệm.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor={`${amountId}-bank`}>Ngân hàng</Label>
              <Select id={`${amountId}-bank`} value={bank} onChange={(e) => setBank(e.target.value)}>
                <option value="">Tất cả ngân hàng</option>
                {banks.map(([slug, name]) => (
                  <option key={slug} value={slug}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`${amountId}-type`}>Loại ưu đãi</Label>
              <Select id={`${amountId}-type`} value={type} onChange={(e) => setType(e.target.value as BenefitType | "")}>
                <option value="">Tất cả loại</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {BENEFIT_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`${amountId}-channel`}>Kênh thanh toán</Label>
              <Select id={`${amountId}-channel`} value={channel} onChange={(e) => setChannel(e.target.value as PaymentChannel | "")}>
                <option value="">Tất cả kênh</option>
                <option value="online">{CHANNEL_LABELS.online}</option>
                <option value="offline">{CHANNEL_LABELS.offline}</option>
              </Select>
            </div>
          </div>
          {filtersActive && (
            <Button variant="link" size="sm" className="mt-2 h-auto" onClick={() => { setBank(""); setType(""); setChannel(""); }}>
              <RotateCcw aria-hidden /> Xóa bộ lọc
            </Button>
          )}
        </div>

        {amount && best.length > 0 && (
          <Alert tone="success" title={`Ước tính tiết kiệm cao nhất: ${formatVnd(outcome.bestSavingsVnd ?? 0)}`}>
            <p>
              {best.map((r) => `${r.deal.title} (${[...new Set(r.deal.cards.map((c) => c.bankName))].join(", ")})`).join("; ")} cho giao dịch {formatVnd(amount)}.
              {best.some((r) => r.result.status === "conditional") && " Ước tính này phụ thuộc vào điều kiện được ghi bên dưới."}
            </p>
          </Alert>
        )}
        {amount && monetary.length > 0 && best.length === 0 && (
          <Alert tone="info" title="Chưa xác định được ưu đãi tiết kiệm nhiều nhất">
            <p>Với số tiền này, không có ưu đãi nào đủ thông tin và điều kiện để ước tính số tiền tiết kiệm.</p>
          </Alert>
        )}

        <section aria-labelledby="h-monetary">
          <h2 id="h-monetary" className="mb-1 text-lg font-bold">
            Hoàn tiền & giảm giá
          </h2>
          <p className="mb-4 flex items-start gap-1.5 text-sm text-ink-muted">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            Mỗi dòng được tính riêng; DealHoi không cộng dồn các ưu đãi vì quy định kết hợp ưu đãi thường không được công bố.
          </p>
          {monetary.length ? (
            <ComparisonTable rows={monetary} today={today} staleAfterDays={staleAfterDays} caption={`So sánh ưu đãi hoàn tiền và giảm giá cho ${target.name}`} />
          ) : (
            <EmptyState title={filtersActive ? "Không có ưu đãi phù hợp bộ lọc" : "Chưa có ưu đãi hoàn tiền hoặc giảm giá"}>{filtersActive ? "Hãy thử bỏ bớt bộ lọc." : NO_VERIFIED_DATA}</EmptyState>
          )}
        </section>

        {installments.length > 0 && (
          <section aria-labelledby="h-installment">
            <h2 id="h-installment" className="mb-1 text-lg font-bold">
              Trả góp
            </h2>
            <p className="mb-4 text-sm text-ink-muted">Trả góp giúp chia nhỏ khoản thanh toán, không phải là khoản tiết kiệm. Kiểm tra phí chuyển đổi và lãi nếu trả chậm.</p>
            <OtherBenefitsList rows={installments} today={today} staleAfterDays={staleAfterDays} kind="installment" />
          </section>
        )}

        {others.length > 0 && (
          <section aria-labelledby="h-other">
            <h2 id="h-other" className="mb-1 text-lg font-bold">
              Điểm thưởng, voucher & đặc quyền
            </h2>
            <p className="mb-4 text-sm text-ink-muted">Các quyền lợi này không được quy đổi ra tiền nên không được xếp hạng cùng hoàn tiền và giảm giá.</p>
            <OtherBenefitsList rows={others} today={today} staleAfterDays={staleAfterDays} kind="other" />
          </section>
        )}

        {inactiveDeals.length > 0 && (
          <details className="rounded-2xl border border-line bg-surface p-4">
            <summary className="cursor-pointer font-medium">Ưu đãi đã hết hạn hoặc chưa bắt đầu ({inactiveDeals.length}) — không được tính</summary>
            <ul className="mt-3 space-y-2 text-sm">
              {inactiveDeals.map((d) => {
                const r = calculateSavings(d, ctx);
                return (
                  <li key={d.id} className="flex flex-wrap justify-between gap-2 border-t border-line pt-2">
                    <span>
                      {d.title} <span className="text-ink-muted">— {[...new Set(d.cards.map((c) => c.bankName))].join(", ")}</span>
                    </span>
                    <span className="text-ink-muted">{r.notes[0]?.message}</span>
                  </li>
                );
              })}
            </ul>
          </details>
        )}

        {activeDeals.length > 0 && (
          <AiSummary
            label="Tóm tắt khác biệt bằng AI"
            request={{ kind: "comparison", ...(target.kind === "merchant" ? { merchantSlug: target.slug } : { categorySlug: target.slug }), purchaseAmountVnd: amount }}
          />
        )}
      </div>

      <ChatPanel
        context={{
          page: "compare",
          ...(target.kind === "merchant" ? { merchantSlug: target.slug } : { categorySlug: target.slug }),
          purchaseAmountVnd: amount,
        }}
      />
    </div>
  );
}
