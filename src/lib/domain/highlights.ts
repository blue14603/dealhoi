import type { DealRecord } from "./types";

/**
 * Transparent highlight rule for card pages (no AI judgement involved):
 *   1. Editorially featured benefits first (is_featured).
 *   2. Ongoing card features before welcome offers before temporary promotions.
 *   3. Monetary benefits (cashback/discount) with a known rate or amount first.
 *   4. Higher known maximum benefit, then higher percentage.
 *   5. Title (stable tie-break).
 */
export const HIGHLIGHT_RULE_DESCRIPTION =
  "Quyền lợi nổi bật được chọn theo quy tắc cố định: ưu tiên quyền lợi do biên tập viên đánh dấu, sau đó quyền lợi thường xuyên trước khuyến mãi có thời hạn, quyền lợi có giá trị tiền xác định, rồi mức tối đa và tỷ lệ cao hơn.";

const OFFER_RANK = { ongoing: 0, welcome: 1, temporary: 2 } as const;

export function rankForHighlight(a: DealRecord, b: DealRecord): number {
  if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
  if (a.offerType !== b.offerType) return OFFER_RANK[a.offerType] - OFFER_RANK[b.offerType];
  const known = (d: DealRecord) =>
    (d.benefitType === "cashback" || d.benefitType === "discount") && (d.percentage !== null || d.fixedAmountVnd !== null) ? 0 : 1;
  if (known(a) !== known(b)) return known(a) - known(b);
  const cap = (d: DealRecord) => d.maximumBenefitVnd ?? d.fixedAmountVnd ?? -1;
  if (cap(a) !== cap(b)) return cap(b) - cap(a);
  const pct = (d: DealRecord) => d.percentage ?? -1;
  if (pct(a) !== pct(b)) return pct(b) - pct(a);
  return a.title.localeCompare(b.title, "vi");
}

export function selectHighlights(deals: DealRecord[], limit = 3): DealRecord[] {
  return [...deals].sort(rankForHighlight).slice(0, limit);
}
