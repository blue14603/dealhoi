import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BENEFIT_TYPE_LABELS, CHANNEL_LABELS, formatVnd, SCOPE_LABELS } from "@/lib/domain/format";
import { describeAdvertisedValue, describeCap, describeMinimumSpend, type SavingsResult } from "@/lib/domain/savings";
import type { DealRecord } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { DemoBadge, OfferTypeBadge, SourceLink, ValidityText, VerificationText } from "./badges";

export interface ComparisonRow {
  deal: DealRecord;
  result: SavingsResult;
}

export function SavingsCell({ result }: { result: SavingsResult }) {
  switch (result.status) {
    case "exact":
      return <span className="font-display text-xl font-bold text-savings tabular">{formatVnd(result.savingsVnd ?? 0)}</span>;
    case "conditional":
      return (
        <span className="flex flex-col items-start gap-1">
          <span className="font-display text-xl font-bold text-ice tabular">≈ {formatVnd(result.savingsVnd ?? 0)}</span>
          <Badge tone="warn">Ước tính có điều kiện</Badge>
        </span>
      );
    case "insufficient_info":
      return (
        <span className="flex flex-col items-start gap-1">
          <Badge tone="neutral">Chưa đủ thông tin</Badge>
          {result.upperBoundVnd !== null && <span className="text-xs text-ink-muted">Không thể ước tính chính xác</span>}
        </span>
      );
    case "not_eligible":
      return <Badge tone="neutral">Không đủ điều kiện</Badge>;
    case "no_amount":
      return <span className="text-xs text-ink-muted">Nhập số tiền để tính</span>;
    default:
      return <span className="text-xs text-ink-muted">Không quy đổi ra tiền</span>;
  }
}

function Notes({ result }: { result: SavingsResult }) {
  if (!result.notes.length) return null;
  return (
    <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-ink-muted">
      {result.notes.map((n) => (
        <li key={n.code}>{n.message}</li>
      ))}
    </ul>
  );
}

function Conditions({ deal }: { deal: DealRecord }) {
  const extra = deal.cards.filter((c) => c.additionalEligibilityTerms);
  const hasAny = deal.eligibilityTerms || deal.termsAndConditions || extra.length;
  return (
    <div className="space-y-1 text-xs">
      <p className="text-ink-muted">
        {SCOPE_LABELS[deal.merchantScope]} · {CHANNEL_LABELS[deal.paymentChannel]}
      </p>
      {hasAny ? (
        <details className="group">
          <summary className="cursor-pointer font-medium text-ink hover:text-accent">Xem điều kiện</summary>
          <div className="mt-1 space-y-1 text-ink-muted">
            {deal.eligibilityTerms && <p>{deal.eligibilityTerms}</p>}
            {deal.termsAndConditions && <p>{deal.termsAndConditions}</p>}
            {extra.map((c) => (
              <p key={c.cardId}>
                <span className="font-medium text-ink">{c.cardName}:</span> {c.additionalEligibilityTerms}
              </p>
            ))}
          </div>
        </details>
      ) : (
        <p className="text-ink-subtle">Nguồn không nêu thêm điều kiện</p>
      )}
    </div>
  );
}

function CardsCell({ deal }: { deal: DealRecord }) {
  const byBank = new Map<string, string[]>();
  deal.cards.forEach((c) => byBank.set(c.bankName, [...(byBank.get(c.bankName) ?? []), c.cardName]));
  return (
    <div className="space-y-1">
      {[...byBank].map(([bank, cards]) => (
        <div key={bank}>
          <p className="font-semibold">{bank}</p>
          <p className="text-xs text-ink-muted">{cards.join(", ")}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Comparison of monetary offers. Desktop: horizontally scrollable table.
 * Mobile: stacked offer cards with the same information.
 */
export function ComparisonTable({ rows, today, staleAfterDays, caption }: { rows: ComparisonRow[]; today: string; staleAfterDays: number; caption: string }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface md:block">
        <table className="w-full min-w-[720px] table-fixed text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[34%]" />
            <col className="w-[20%]" />
            <col className="w-[24%]" />
          </colgroup>
          <thead className="border-b border-line bg-surface-2 text-[0.7rem] uppercase tracking-[0.12em] text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Ngân hàng & thẻ</th>
              <th scope="col" className="px-4 py-3 font-medium">Ưu đãi · mức · tối đa · tối thiểu</th>
              <th scope="col" className="px-4 py-3 font-medium">Tiết kiệm ước tính</th>
              <th scope="col" className="px-4 py-3 font-medium">Điều kiện, hiệu lực & nguồn</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ deal, result }) => (
              <tr key={deal.id} className={cn("border-b border-line align-top last:border-0", result.isBest && "bg-savings-soft/70 shadow-[inset_3px_0_0_var(--color-savings)]")} data-testid="comparison-row">
                <td className="px-4 py-4">
                  <CardsCell deal={deal} />
                </td>
                <td className="px-4 py-4">
                  <p className="font-display text-base font-bold">{deal.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone="brand">{BENEFIT_TYPE_LABELS[deal.benefitType]}</Badge>
                    <OfferTypeBadge type={deal.offerType} />
                    {deal.isDemo && <DemoBadge />}
                    {result.isBest && (
                      <Badge tone="savings">
                        <Trophy aria-hidden /> Tiết kiệm cao nhất
                      </Badge>
                    )}
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-ink-subtle">Mức</dt>
                      <dd className="font-display text-lg font-bold text-ice tabular">{describeAdvertisedValue(deal)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-subtle">Tối đa</dt>
                      <dd className="tabular">{describeCap(deal)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-subtle">Tối thiểu</dt>
                      <dd className="tabular">{describeMinimumSpend(deal)}</dd>
                    </div>
                  </dl>
                </td>
                <td className="px-4 py-4">
                  <SavingsCell result={result} />
                  <Notes result={result} />
                </td>
                <td className="space-y-2 px-4 py-4 text-xs">
                  <Conditions deal={deal} />
                  <div>
                    <ValidityText startDate={deal.startDate} endDate={deal.endDate} lifecycle={result.lifecycle} today={today} offerType={deal.offerType} />
                  </div>
                  <div>
                    <VerificationText source={deal.source} staleAfterDays={staleAfterDays} />
                  </div>
                  <SourceLink source={deal.source} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {rows.map(({ deal, result }) => (
          <li key={deal.id} className={cn("rounded-2xl border bg-surface p-4", result.isBest ? "border-savings/70" : "border-line")} data-testid="comparison-card">
            {result.isBest && (
              <Badge tone="savings" className="mb-2">
                <Trophy aria-hidden /> Tiết kiệm cao nhất
              </Badge>
            )}
            <p className="font-display text-base font-bold">{deal.title}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge tone="brand">{BENEFIT_TYPE_LABELS[deal.benefitType]}</Badge>
              <OfferTypeBadge type={deal.offerType} />
              {deal.isDemo && <DemoBadge />}
            </div>
            <div className="mt-3 text-sm">
              <CardsCell deal={deal} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-ink-subtle">Mức ưu đãi</dt>
                <dd className="font-semibold tabular">{describeAdvertisedValue(deal)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">Tối đa</dt>
                <dd className="tabular">{describeCap(deal)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">Chi tiêu tối thiểu</dt>
                <dd className="tabular">{describeMinimumSpend(deal)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">Tiết kiệm ước tính</dt>
                <dd>
                  <SavingsCell result={result} />
                </dd>
              </div>
            </dl>
            <Notes result={result} />
            <div className="mt-3 border-t border-line pt-3">
              <Conditions deal={deal} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <ValidityText startDate={deal.startDate} endDate={deal.endDate} lifecycle={result.lifecycle} today={today} offerType={deal.offerType} />
              <SourceLink source={deal.source} />
            </div>
            <p className="mt-1 text-xs">
              <VerificationText source={deal.source} staleAfterDays={staleAfterDays} />
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Installment plans and non-monetary benefits: shown separately, never ranked by money. */
export function OtherBenefitsList({ rows, today, staleAfterDays, kind }: { rows: ComparisonRow[]; today: string; staleAfterDays: number; kind: "installment" | "other" }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {rows.map(({ deal, result }) => (
        <li key={deal.id} className="rounded-2xl border border-line bg-surface p-4 text-sm">
          <div className="flex flex-wrap gap-1">
            <Badge tone={kind === "installment" ? "info" : "neutral"}>{BENEFIT_TYPE_LABELS[deal.benefitType]}</Badge>
            <OfferTypeBadge type={deal.offerType} />
            {deal.isDemo && <DemoBadge />}
          </div>
          <p className="mt-2 font-semibold">{deal.title}</p>
          <p className="mt-1 text-ink-muted">{deal.description}</p>
          <div className="mt-2">
            <CardsCell deal={deal} />
          </div>
          {kind === "installment" && (
            <dl className="mt-3 grid grid-cols-3 gap-2">
              <div>
                <dt className="text-xs text-ink-subtle">Kỳ hạn</dt>
                <dd className="font-semibold">{deal.installmentMonths ? `${deal.installmentMonths} tháng` : "Chưa rõ"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">Phí chuyển đổi</dt>
                <dd className="tabular">{deal.installmentFeeVnd === null ? "Chưa rõ" : formatVnd(deal.installmentFeeVnd)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">Tối thiểu</dt>
                <dd className="tabular">{describeMinimumSpend(deal)}</dd>
              </div>
            </dl>
          )}
          {result.status === "not_eligible" && <p className="mt-2 text-xs font-medium text-warn">{result.notes.at(-1)?.message}</p>}
          <div className="mt-3">
            <Conditions deal={deal} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs">
            <ValidityText startDate={deal.startDate} endDate={deal.endDate} lifecycle={result.lifecycle} today={today} offerType={deal.offerType} />
            <SourceLink source={deal.source} />
          </div>
          <p className="mt-1 text-xs">
            <VerificationText source={deal.source} staleAfterDays={staleAfterDays} />
          </p>
        </li>
      ))}
    </ul>
  );
}
