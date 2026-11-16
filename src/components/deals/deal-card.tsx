import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatVnd, SCOPE_LABELS } from "@/lib/domain/format";
import { describeAdvertisedValue, describeCap, describeMinimumSpend, type SavingsResult } from "@/lib/domain/savings";
import type { DealRecord } from "@/lib/domain/types";
import { getDealLifecycle } from "@/lib/domain/validity";
import { BenefitTypeBadge, DemoBadge, OfferTypeBadge, SourceLink, ValidityText, VerificationText } from "./badges";

export function compareHref(deal: DealRecord) {
  return deal.merchant && deal.merchantScope === "specific_merchant" ? `/so-sanh?merchant=${deal.merchant.slug}` : `/so-sanh?category=${deal.category.slug}`;
}

export function DealCard({ deal, today, staleAfterDays, savings }: { deal: DealRecord; today: string; staleAfterDays: number; savings?: SavingsResult }) {
  const lifecycle = getDealLifecycle(deal, today);
  const banks = [...new Set(deal.cards.map((c) => c.bankName))].join(", ");
  return (
    <Card className="lift flex h-full flex-col rounded-3xl p-5">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <BenefitTypeBadge type={deal.benefitType} />
        <OfferTypeBadge type={deal.offerType} />
        {deal.isDemo && <DemoBadge />}
      </div>
      <h3 className="font-display text-lg leading-snug font-bold">{deal.title}</h3>
      <p className="mt-1 text-sm text-ink-muted">
        {deal.merchant && deal.merchantScope === "specific_merchant" ? deal.merchant.name : SCOPE_LABELS[deal.merchantScope]} · {deal.category.name}
      </p>
      <p className="mt-2 text-sm">
        <span className="font-medium">{banks}</span>
        <span className="text-ink-muted"> — {deal.cards.map((c) => c.cardName).join(", ")}</span>
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-ink-subtle">Mức ưu đãi</dt>
          <dd className="font-display text-2xl leading-tight font-bold tracking-[-0.03em] text-ice tabular">{describeAdvertisedValue(deal)}</dd>
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
          <dt className="text-xs text-ink-subtle">Hiệu lực</dt>
          <dd className="text-sm">
            <ValidityText startDate={deal.startDate} endDate={deal.endDate} lifecycle={lifecycle} today={today} offerType={deal.offerType} />
          </dd>
        </div>
      </dl>
      {savings && (savings.status === "exact" || savings.status === "conditional") && savings.savingsVnd !== null && (
        <p className="mt-3 rounded-lg bg-savings-soft px-3 py-2 text-sm text-savings">
          Tiết kiệm ước tính <strong className="tabular">{formatVnd(savings.savingsVnd)}</strong>
          {savings.status === "conditional" && " (có điều kiện)"}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs">
        <VerificationText source={deal.source} staleAfterDays={staleAfterDays} />
        <SourceLink source={deal.source} />
      </div>
      <Link href={compareHref(deal)} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-ice">
        So sánh với các thẻ khác <ArrowRight className="size-4" aria-hidden />
      </Link>
    </Card>
  );
}
