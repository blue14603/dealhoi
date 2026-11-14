import type { DealRecord } from "./types";

export const TIMEZONE = "Asia/Ho_Chi_Minh";

/** Today's calendar date (YYYY-MM-DD) in Vietnam. */
export function todayInVietnam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export type DealLifecycle =
  | "active"
  | "upcoming"
  | "expired"
  | "withdrawn"
  | "unverified"
  /** A temporary promotion without a verified validity period. */
  | "validity_unknown";

type LifecycleInput = Pick<
  DealRecord,
  "offerType" | "startDate" | "endDate" | "verificationStatus" | "publicationStatus"
>;

/**
 * Determines whether a deal can be treated as currently active.
 * - Withdrawn or unpublished/unverified deals are never active.
 * - Temporary promotions need both a start and an end date.
 * - Ongoing and welcome benefits may have no fixed end date (the source confirms
 *   they remain in effect), but any dates present are respected.
 */
export function getDealLifecycle(deal: LifecycleInput, today: string): DealLifecycle {
  if (deal.publicationStatus === "withdrawn") return "withdrawn";
  if (deal.publicationStatus !== "published" || deal.verificationStatus !== "verified") return "unverified";
  if (deal.offerType === "temporary" && (!deal.startDate || !deal.endDate)) return "validity_unknown";
  if (deal.startDate && today < deal.startDate) return "upcoming";
  if (deal.endDate && today > deal.endDate) return "expired";
  return "active";
}

export function isDealActive(deal: LifecycleInput, today: string): boolean {
  return getDealLifecycle(deal, today) === "active";
}

/** Whole days from `today` until `date` (both YYYY-MM-DD). Negative if in the past. */
export function daysBetween(today: string, date: string): number {
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const b = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export function isVerificationStale(verifiedAt: string | null, now: Date, staleAfterDays: number): boolean {
  if (!verifiedAt) return true;
  const age = now.getTime() - new Date(verifiedAt).getTime();
  return age > staleAfterDays * 86_400_000;
}

export const LIFECYCLE_LABELS: Record<DealLifecycle, string> = {
  active: "Đang áp dụng",
  upcoming: "Sắp diễn ra",
  expired: "Đã hết hạn",
  withdrawn: "Đã dừng",
  unverified: "Chưa xác minh",
  validity_unknown: "Chưa rõ thời hạn",
};
