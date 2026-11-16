import { BadgeCheck, CalendarClock, ExternalLink, FlaskConical, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BENEFIT_TYPE_LABELS, OFFER_TYPE_LABELS, formatDate, formatTimestampDate } from "@/lib/domain/format";
import type { BenefitType, OfferType, SourceRecord } from "@/lib/domain/types";
import { LIFECYCLE_LABELS, daysBetween, isVerificationStale, type DealLifecycle } from "@/lib/domain/validity";

export function BenefitTypeBadge({ type }: { type: BenefitType }) {
  const tone = type === "cashback" || type === "discount" ? "brand" : type === "installment" ? "info" : "neutral";
  return <Badge tone={tone}>{BENEFIT_TYPE_LABELS[type]}</Badge>;
}

export function OfferTypeBadge({ type }: { type: OfferType }) {
  return <Badge tone={type === "ongoing" ? "outline" : type === "welcome" ? "info" : "warn"}>{OFFER_TYPE_LABELS[type]}</Badge>;
}

export function DemoBadge() {
  return (
    <Badge tone="warn" title="Dữ liệu hư cấu dùng để trình diễn">
      <FlaskConical aria-hidden /> Minh họa
    </Badge>
  );
}

/** Validity period with expiry warning. */
export function ValidityText({ startDate, endDate, lifecycle, today, offerType }: { startDate: string | null; endDate: string | null; lifecycle: DealLifecycle; today: string; offerType: OfferType }) {
  if (lifecycle !== "active") {
    return (
      <span className="text-ink-muted">
        {LIFECYCLE_LABELS[lifecycle]}
        {endDate && lifecycle === "expired" ? ` (${formatDate(endDate)})` : ""}
        {startDate && lifecycle === "upcoming" ? ` (từ ${formatDate(startDate)})` : ""}
      </span>
    );
  }
  if (!endDate) return <span>{offerType === "ongoing" ? "Thường xuyên, chưa có ngày kết thúc" : "Chưa có ngày kết thúc"}</span>;
  const days = daysBetween(today, endDate);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="tabular">
        {startDate ? `${formatDate(startDate)} – ` : "Đến "}
        {formatDate(endDate)}
      </span>
      {days <= 7 && (
        <Badge tone="warn">
          <CalendarClock aria-hidden /> {days === 0 ? "Hết hạn hôm nay" : `Còn ${days} ngày`}
        </Badge>
      )}
    </span>
  );
}

export function VerificationText({ source, staleAfterDays, now }: { source: SourceRecord | null; staleAfterDays: number; now?: number }) {
  if (!source?.verifiedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-warn">
        <ShieldAlert className="size-3.5" aria-hidden /> Chưa có thông tin xác minh
      </span>
    );
  }
  const stale = isVerificationStale(source.verifiedAt, new Date(now ?? Date.now()), staleAfterDays);
  return (
    <span className={stale ? "inline-flex items-center gap-1 text-warn" : "inline-flex items-center gap-1 text-ink-muted"}>
      {stale ? <ShieldAlert className="size-3.5" aria-hidden /> : <BadgeCheck className="size-3.5 text-savings" aria-hidden />}
      Xác minh {formatTimestampDate(source.verifiedAt)}
      {stale && " · cần xác minh lại"}
    </span>
  );
}

export function SourceLink({ source, className }: { source: SourceRecord | null; className?: string }) {
  if (!source) return <span className="text-ink-subtle">Không có nguồn</span>;
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={className ?? "inline-flex items-center gap-1 font-medium text-accent underline-offset-2 hover:underline"}
    >
      {source.isDemo ? "Nguồn minh họa" : source.sourceType === "official_bank" ? `Trang chính thức ${source.publisher}` : source.publisher}
      <ExternalLink className="size-3.5" aria-hidden />
      <span className="sr-only">(mở trong thẻ mới)</span>
    </a>
  );
}
