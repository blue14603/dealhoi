import Link from "next/link";
import { DemoBadge } from "@/components/deals/badges";
import { formatVnd } from "@/lib/domain/format";
import type { CardRecord } from "@/lib/domain/types";
import { CardVisual } from "./card-visual";

export function CreditCardTile({ card, benefitCount }: { card: CardRecord; benefitCount?: number }) {
  return (
    <Link href={`/the-tin-dung/${card.slug}`} className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-4 transition-shadow hover:shadow-md">
      <CardVisual name={card.name} bankName={card.bank.name} network={card.network} tier={card.cardTier} imageUrl={card.imageUrl} />
      <div className="mt-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-ink-muted">{card.bank.name}</p>
          <h3 className="font-semibold leading-snug group-hover:text-brand">{card.name}</h3>
        </div>
        {card.isDemo && <DemoBadge />}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-ink-subtle">Phí thường niên</dt>
          <dd className="tabular">{card.annualFeeVnd === null ? "Chưa rõ" : card.annualFeeVnd === 0 ? "Miễn phí" : formatVnd(card.annualFeeVnd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-subtle">{benefitCount !== undefined ? "Quyền lợi đã xác minh" : "Hạng thẻ"}</dt>
          <dd>{benefitCount !== undefined ? benefitCount : (card.cardTier ?? "—")}</dd>
        </div>
      </dl>
    </Link>
  );
}
