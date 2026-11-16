import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { DiscoveryConcept } from "@/config/discovery";
import { BENEFIT_TYPE_LABELS, CAP_PERIOD_LABELS, formatDate, formatVnd } from "@/lib/domain/format";
import { describeAdvertisedValue, describeMinimumSpend } from "@/lib/domain/savings";
import type { DealRecord } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const VERB: Partial<Record<DealRecord["benefitType"], string>> = {
  cashback: "Hoàn",
  discount: "Giảm",
  installment: "Trả góp",
  points: "Tích điểm",
};

/** Plain-language cap line, bound to the verified record. */
function capLine(d: DealRecord): string | null {
  if (d.maximumBenefitVnd !== null) return `Tối đa ${formatVnd(d.maximumBenefitVnd)}${d.capPeriod ? ` ${CAP_PERIOD_LABELS[d.capPeriod]}` : ""}`;
  if (d.capIsUnlimited) return "Không giới hạn mức hoàn";
  if (d.percentage !== null) return "Chưa rõ mức tối đa";
  if (d.benefitType === "installment") {
    if (d.installmentFeeVnd === null) return "Chưa rõ phí chuyển đổi";
    return d.installmentFeeVnd === 0 ? "Phí chuyển đổi 0 ₫" : `Phí chuyển đổi ${formatVnd(d.installmentFeeVnd)}`;
  }
  return null;
}

/**
 * Art-directed discovery tile. One shared component; each concept varies only
 * its artwork, placement, motion and bento span (see config/discovery.ts).
 * The whole card is a single link to the existing comparison route.
 */
export function EditorialDealCard({ concept, deal, href, activeOfferCount }: { concept: DiscoveryConcept; deal: DealRecord | null; href: string; activeOfferCount: number }) {
  const { art } = concept;
  const motion = {
    "--rest-r": art.restRotate,
    "--hx": art.hover.x,
    "--hy": art.hover.y,
    "--hr": art.hover.rotate,
    "--hs": art.hover.scale,
  } as CSSProperties;
  const banks = deal ? [...new Set(deal.cards.map((c) => c.bankName))].join(", ") : "";
  const others = Math.max(0, activeOfferCount - (deal ? 1 : 0));
  const cap = deal ? capLine(deal) : null;

  return (
    <Link
      href={href}
      style={motion}
      className={cn(
        "ed-card group @container relative isolate flex min-h-[320px] flex-col overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:min-h-[360px] sm:p-8",
        concept.span,
      )}
      data-testid={`discovery-${concept.key}`}
    >
      {/* Localized light behind the asset */}
      <span
        aria-hidden
        className={cn("ed-glow pointer-events-none absolute -z-10 size-64 rounded-full bg-[radial-gradient(circle,rgb(36_87_255/0.5),transparent_68%)] blur-2xl", art.glow)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={art.src}
        width={art.width}
        height={art.height}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className={cn("ed-asset pointer-events-none absolute -z-10 h-auto select-none", art.position)}
      />

      <p className="eyebrow flex items-center gap-3">
        <span className="font-display text-ice tabular">{concept.index}</span>
        <span aria-hidden className="h-px w-6 bg-line-strong" />
        {concept.label}
      </p>

      <div className="mt-5 max-w-[62%] sm:max-w-[58%]">
        <h3 className="font-display text-[1.9rem] leading-[0.95] font-bold text-ink @[30rem]:text-[2.5rem]">{concept.headline}</h3>
        {concept.subhead && <p className="mt-2 text-sm text-ink-muted">{concept.subhead}</p>}
      </div>

      <div className="mt-auto max-w-[64%] pt-8 sm:max-w-[58%]">
        {deal ? (
          <>
            <p className="text-sm font-medium text-ink-muted">{VERB[deal.benefitType] ?? BENEFIT_TYPE_LABELS[deal.benefitType]}</p>
            <p className="font-display text-[2.4rem] leading-none font-bold tracking-[-0.045em] whitespace-nowrap text-ice tabular @[30rem]:text-[3rem] @[36rem]:text-[3.5rem]">
              {describeAdvertisedValue(deal)}
            </p>
            <p className="mt-2 text-sm font-medium text-ink">{deal.title}</p>
            <ul className="mt-2 space-y-0.5 text-xs text-ink-muted">
              {cap && <li>{cap}</li>}
              <li>Chi tiêu tối thiểu: {describeMinimumSpend(deal)}</li>
              <li>
                {banks}
                {deal.isDemo && <span className="ml-1.5 rounded bg-warn-soft px-1.5 py-px font-medium text-warn">Minh họa</span>}
              </li>
              {deal.endDate && <li>Đến {formatDate(deal.endDate)}</li>}
            </ul>
          </>
        ) : (
          <>
            <p className="font-display text-2xl font-bold text-ink-muted">Chưa có ưu đãi</p>
            <p className="mt-1 text-sm text-ink-muted">DealHoi chưa có ưu đãi đã xác minh cho mục này.</p>
          </>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="ed-cta inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-4 py-2.5 text-sm font-semibold text-ink">
            Khám phá ưu đãi
            <ArrowUpRight className="ed-cta-arrow size-4" aria-hidden />
          </span>
          {others > 0 && <span className="text-xs text-ink-muted">+{others} ưu đãi khác</span>}
        </div>
      </div>
    </Link>
  );
}
