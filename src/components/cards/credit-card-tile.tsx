import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { DemoBadge } from "@/components/deals/badges";
import { BENEFIT_TYPE_LABELS, formatVnd } from "@/lib/domain/format";
import { describeAdvertisedValue } from "@/lib/domain/savings";
import type { CardRecord, DealRecord } from "@/lib/domain/types";
import { CardVisual } from "./card-visual";

function fee(card: CardRecord) {
  return card.annualFeeVnd === null ? "Chưa rõ" : card.annualFeeVnd === 0 ? "Miễn phí" : formatVnd(card.annualFeeVnd);
}

/**
 * Credit card preview. `headline` is the card's main verified active benefit
 * (chosen by the fixed highlight rule) or null when none is available.
 */
export function CreditCardTile({
  card,
  benefitCount,
  headline,
  categories,
}: {
  card: CardRecord;
  benefitCount?: number;
  headline?: DealRecord | null;
  categories?: string[];
}) {
  return (
    <Link href={`/the-tin-dung/${card.slug}`} className="lift group flex h-full flex-col rounded-3xl border border-line bg-surface p-5">
      <div className="lift-asset px-2 pt-2">
        <CardVisual name={card.name} bankName={card.bank.name} network={card.network} tier={card.cardTier} imageUrl={card.imageUrl} />
      </div>
      <div className="mt-6 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">{card.bank.name}</p>
          <h3 className="font-display mt-1 text-xl leading-tight font-bold">{card.name}</h3>
        </div>
        {card.isDemo && <DemoBadge />}
      </div>

      {headline !== undefined && (
        <div className="mt-4 rounded-2xl bg-surface-2 p-4">
          {headline ? (
            <>
              <p className="text-xs text-ink-muted">{BENEFIT_TYPE_LABELS[headline.benefitType]} nổi bật</p>
              <p className="font-display mt-0.5 text-3xl leading-none font-bold tracking-[-0.04em] text-ice tabular">
                {describeAdvertisedValue(headline) === "—" ? BENEFIT_TYPE_LABELS[headline.benefitType] : describeAdvertisedValue(headline)}
              </p>
              <p className="mt-1.5 text-sm">{headline.title}</p>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Chưa có quyền lợi đang áp dụng đã xác minh.</p>
          )}
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-ink-subtle">Phí thường niên</dt>
          <dd className="tabular">{fee(card)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-subtle">{categories ? "Hợp với" : benefitCount !== undefined ? "Quyền lợi đã xác minh" : "Hạng thẻ"}</dt>
          <dd className="line-clamp-2">{categories ? categories.slice(0, 2).join(", ") || "—" : benefitCount !== undefined ? benefitCount : (card.cardTier ?? "—")}</dd>
        </div>
      </dl>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-accent">
        Xem chi tiết thẻ <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
      </span>
    </Link>
  );
}
