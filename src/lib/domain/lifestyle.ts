import { BENEFIT_TYPE_LABELS, CAP_PERIOD_LABELS, formatVnd } from "./format";
import type { CardRecord, DealRecord } from "./types";
import { getDealLifecycle } from "./validity";

export interface LifestyleProfile {
  categories: string[];
  rewardTypes: string[];
  summary: string;
  considerations: string[];
}

/** Deterministic lifestyle explanation derived only from verified active benefits. */
export function describeLifestyle(card: CardRecord, deals: DealRecord[], today: string): LifestyleProfile | null {
  const active = deals.filter((d) => getDealLifecycle(d, today) === "active");
  if (!active.length) return null;
  const general = active.some((d) => d.merchantScope === "general" && d.offerType !== "welcome");
  const categories = [...new Set(active.filter((d) => d.merchantScope !== "general").map((d) => d.category.name))];
  const rewardTypes = [...new Set(active.map((d) => BENEFIT_TYPE_LABELS[d.benefitType].toLowerCase()))];
  const parts: string[] = [];
  if (categories.length) parts.push(`thường chi tiêu cho ${categories.join(", ").toLowerCase()}`);
  if (general) parts.push("muốn nhận ưu đãi trên chi tiêu hằng ngày");
  const summary = `Thẻ này có thể phù hợp với người ${parts.join(" và ") || "có nhu cầu tương ứng với các quyền lợi bên dưới"}, và ưu tiên quyền lợi dạng ${rewardTypes.join(", ")}.`;

  const considerations: string[] = [];
  const monthlyMins = active.filter((d) => d.minimumSpendVnd && d.minimumSpendPeriod && d.minimumSpendPeriod !== "transaction");
  for (const d of monthlyMins.slice(0, 3)) {
    considerations.push(`Cần chi tiêu tối thiểu ${formatVnd(d.minimumSpendVnd!)} ${CAP_PERIOD_LABELS[d.minimumSpendPeriod!]} cho “${d.title}”.`);
  }
  const caps = active.filter((d) => d.maximumBenefitVnd !== null && d.capPeriod && d.capPeriod !== "transaction");
  if (caps.length) considerations.push("Một số quyền lợi có giới hạn tối đa theo tháng hoặc theo chương trình, nên chi tiêu nhiều hơn không làm tăng lợi ích.");
  if (card.annualFeeVnd === null) considerations.push("Phí thường niên chưa được xác minh.");
  else if (card.annualFeeVnd > 0) considerations.push(`Phí thường niên ${formatVnd(card.annualFeeVnd)}${card.annualFeeWaiverTerms ? ` (${card.annualFeeWaiverTerms})` : ""}: lợi ích cần lớn hơn phí này.`);
  if (active.some((d) => d.offerType === "temporary")) considerations.push("Một số ưu đãi là khuyến mãi có thời hạn và có thể kết thúc.");
  return { categories, rewardTypes, summary, considerations };
}
