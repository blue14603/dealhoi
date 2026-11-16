import { BenefitTypeBadge, DemoBadge, OfferTypeBadge, SourceLink, ValidityText, VerificationText } from "@/components/deals/badges";
import { compareHref } from "@/components/deals/deal-card";
import { BENEFIT_TYPE_LABELS, CHANNEL_LABELS, SCOPE_LABELS } from "@/lib/domain/format";
import { describeAdvertisedValue, describeCap, describeMinimumSpend } from "@/lib/domain/savings";
import type { DealRecord } from "@/lib/domain/types";
import { getDealLifecycle } from "@/lib/domain/validity";
import { cn } from "@/lib/utils";

export function BenefitItem({ deal, today, staleAfterDays, cardId, highlight, index }: { deal: DealRecord; today: string; staleAfterDays: number; cardId: string; highlight?: boolean; index?: number }) {
  const lifecycle = getDealLifecycle(deal, today);
  const extra = deal.cards.find((c) => c.cardId === cardId)?.additionalEligibilityTerms;
  return (
    <article className={cn("rounded-2xl border bg-surface p-5", highlight ? "rounded-3xl border-brand/50 bg-[linear-gradient(160deg,#16214a_0%,#141720_55%)] p-6 sm:p-7" : "border-line", lifecycle !== "active" && "opacity-75")}>
      {highlight && (
        <div className="mb-4 flex items-end justify-between gap-4">
          {describeAdvertisedValue(deal) === "—" ? (
            <p className="font-display text-[1.75rem] leading-none font-bold tracking-[-0.03em] text-ice sm:text-[2.25rem]">{BENEFIT_TYPE_LABELS[deal.benefitType]}</p>
          ) : (
            <p className="font-display text-[2.75rem] leading-none font-bold tracking-[-0.045em] text-ice tabular sm:text-[3.5rem]">{describeAdvertisedValue(deal)}</p>
          )}
          {index !== undefined && <span className="font-display text-sm font-semibold text-chrome tabular">0{index}</span>}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <BenefitTypeBadge type={deal.benefitType} />
        <OfferTypeBadge type={deal.offerType} />
        {deal.isDemo && <DemoBadge />}
      </div>
      <h3 className={cn("mt-2 font-display font-bold", highlight ? "text-2xl" : "text-lg")}>{deal.title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{deal.description}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-4">
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
          <dt className="text-xs text-ink-subtle">Áp dụng</dt>
          <dd>{deal.merchant && deal.merchantScope === "specific_merchant" ? deal.merchant.name : SCOPE_LABELS[deal.merchantScope]}</dd>
        </div>
      </dl>
      {(deal.eligibilityTerms || deal.termsAndConditions || extra) && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium hover:text-accent">Điều kiện & điều khoản</summary>
          <div className="mt-1 space-y-1 text-ink-muted">
            <p>Kênh: {CHANNEL_LABELS[deal.paymentChannel]}</p>
            {deal.eligibilityTerms && <p>{deal.eligibilityTerms}</p>}
            {deal.termsAndConditions && <p>{deal.termsAndConditions}</p>}
            {extra && <p>Riêng thẻ này: {extra}</p>}
          </div>
        </details>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs">
        <ValidityText startDate={deal.startDate} endDate={deal.endDate} lifecycle={lifecycle} today={today} offerType={deal.offerType} />
        <span className="flex flex-wrap items-center gap-3">
          <VerificationText source={deal.source} staleAfterDays={staleAfterDays} />
          <SourceLink source={deal.source} />
        </span>
      </div>
      {lifecycle === "active" && deal.offerType !== "welcome" && (
        <a href={compareHref(deal)} className="mt-2 inline-block text-xs font-medium text-ink-muted hover:text-accent">
          So sánh với thẻ khác →
        </a>
      )}
    </article>
  );
}
