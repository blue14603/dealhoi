import type { ScoringWeights } from "@/config/scoring";
import { BENEFIT_TYPE_LABELS, CAP_PERIOD_LABELS, formatVnd } from "./format";
import { FEE_PREFERENCES, REWARD_PREFERENCES, SPEND_RANGES, type QuizAnswers } from "./quiz";
import type { BenefitType, CapPeriod, CardRecord, DealRecord } from "./types";
import { daysBetween, getDealLifecycle } from "./validity";

export type DimensionKey = keyof ScoringWeights;
export type DimensionStatus = "scored" | "insufficient" | "not_applicable";

export interface DimensionResult {
  key: DimensionKey;
  label: string;
  weight: number;
  status: DimensionStatus;
  /** 0–100, null unless scored. */
  score: number | null;
  explanation: string;
  details: string[];
}

export interface UsableBenefit {
  dealId: string;
  title: string;
  categoryName: string;
  why: string;
}

export interface CompatibilityResult {
  cardId: string;
  /** 0–100, or null when no reliable score can be calculated. */
  score: number | null;
  reliability: "reliable" | "provisional" | "insufficient";
  reliabilityExplanation: string;
  dimensions: DimensionResult[];
  reasons: string[];
  drawbacks: string[];
  usableBenefits: UsableBenefit[];
  blockingConditions: string[];
  balanceWarning: string | null;
  relevantDealIds: string[];
  disclaimer: string;
}

export const COMPATIBILITY_DISCLAIMER =
  "Điểm này chỉ ước tính mức độ phù hợp giữa quyền lợi của thẻ và thói quen chi tiêu bạn đã khai báo. Đây không phải đánh giá khả năng tín dụng, xác suất được duyệt thẻ hay lời khuyên tài chính.";

export const BALANCE_WARNING =
  "Nếu bạn không thanh toán toàn bộ dư nợ mỗi tháng, lãi suất và phí trả chậm của thẻ tín dụng thường cao hơn nhiều so với giá trị hoàn tiền hoặc điểm thưởng. Trong trường hợp đó, chi phí có thể vượt xa lợi ích của bất kỳ ưu đãi nào.";

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  categoryAlignment: "Mức độ khớp danh mục chi tiêu",
  spendingConditions: "Khả năng đáp ứng điều kiện chi tiêu",
  rewardAlignment: "Phù hợp loại ưu đãi mong muốn",
  annualFee: "Phù hợp phí thường niên",
};

const PREFERENCE_TYPES: Record<Exclude<QuizAnswers["rewardPreference"], "no_preference">, BenefitType[]> = {
  cashback: ["cashback"],
  discount: ["discount", "voucher"],
  points: ["points"],
  installment: ["installment"],
  travel: ["travel_perk"],
};

const PERIOD_TO_MONTHS: Partial<Record<CapPeriod, number>> = { month: 1, quarter: 3, year: 12 };

export interface CompatibilityInput {
  card: CardRecord;
  deals: DealRecord[];
  answers: QuizAnswers;
  weights: ScoringWeights;
  today: string;
  categoryNames: Record<string, string>;
}

function appliesToCategory(deal: DealRecord, slug: string): boolean {
  return deal.merchantScope === "general" || deal.category.slug === slug;
}

export function scoreCompatibility(input: CompatibilityInput): CompatibilityResult {
  const { card, answers, weights, today, categoryNames } = input;
  const active = input.deals.filter((d) => getDealLifecycle(d, today) === "active");
  const userCats = [...new Set(answers.categories)];
  const catName = (s: string) => categoryNames[s] ?? s;
  const range = SPEND_RANGES[answers.monthlySpend];

  const reasons: string[] = [];
  const drawbacks: string[] = [];
  const blocking: string[] = [];
  const dimensions: DimensionResult[] = [];

  const relevant = active.filter((d) => userCats.some((c) => appliesToCategory(d, c)));

  // 1. Category alignment ----------------------------------------------------
  {
    const key: DimensionKey = "categoryAlignment";
    if (userCats.length === 0) {
      dimensions.push({ key, label: DIMENSION_LABELS[key], weight: weights[key], status: "insufficient", score: null, explanation: "Bạn chưa chọn danh mục chi tiêu chính.", details: [] });
    } else if (active.length === 0) {
      dimensions.push({ key, label: DIMENSION_LABELS[key], weight: weights[key], status: "insufficient", score: null, explanation: "DealHoi chưa có quyền lợi đã xác minh đang áp dụng cho thẻ này.", details: [] });
    } else {
      const matched = userCats.filter((c) => active.some((d) => appliesToCategory(d, c)));
      const unmatched = userCats.filter((c) => !matched.includes(c));
      const spendEntries = userCats.map((c) => [c, answers.categorySpend[c] ?? 0] as const);
      const totalSpend = spendEntries.reduce((a, [, v]) => a + v, 0);
      let score: number;
      let explanation: string;
      if (totalSpend > 0) {
        const matchedSpend = spendEntries.filter(([c]) => matched.includes(c)).reduce((a, [, v]) => a + v, 0);
        score = Math.round((matchedSpend / totalSpend) * 100);
        explanation = `Khoảng ${score}% chi tiêu bạn ước tính (${formatVnd(matchedSpend)}/${formatVnd(totalSpend)} mỗi tháng) thuộc danh mục có quyền lợi đã xác minh.`;
      } else {
        score = Math.round((matched.length / userCats.length) * 100);
        explanation = `${matched.length}/${userCats.length} danh mục bạn chọn có quyền lợi đã xác minh.`;
      }
      const details = [
        ...matched.map((c) => `Có quyền lợi: ${catName(c)}`),
        ...unmatched.map((c) => `Chưa có quyền lợi đã xác minh: ${catName(c)}`),
      ];
      if (matched.length) reasons.push(`Có quyền lợi cho ${matched.map(catName).join(", ")}.`);
      if (unmatched.length) drawbacks.push(`Chưa có quyền lợi đã xác minh cho ${unmatched.map(catName).join(", ")}.`);
      dimensions.push({ key, label: DIMENSION_LABELS[key], weight: weights[key], status: "scored", score, explanation, details });
    }
  }

  // 2. Spending conditions ---------------------------------------------------
  {
    const key: DimensionKey = "spendingConditions";
    const evaluations: { score: number; detail: string }[] = [];
    const unknown: string[] = [];
    for (const d of relevant) {
      const min = d.minimumSpendVnd;
      if (min === null) {
        unknown.push(`${d.title}: chưa rõ yêu cầu chi tiêu tối thiểu`);
        continue;
      }
      if (min === 0) {
        evaluations.push({ score: 100, detail: `${d.title}: không yêu cầu chi tiêu tối thiểu` });
        continue;
      }
      const months = d.minimumSpendPeriod ? PERIOD_TO_MONTHS[d.minimumSpendPeriod] : undefined;
      if (!months) {
        unknown.push(
          d.minimumSpendPeriod === "transaction"
            ? `${d.title}: yêu cầu ${formatVnd(min)} mỗi giao dịch (tùy giá trị từng lần mua)`
            : `${d.title}: yêu cầu ${formatVnd(min)}, chưa rõ cách tính theo kỳ`,
        );
        continue;
      }
      const monthlyNeed = Math.ceil(min / months);
      const periodLabel = CAP_PERIOD_LABELS[d.minimumSpendPeriod as CapPeriod];
      const catSpend = d.merchantScope === "general" ? undefined : answers.categorySpend[d.category.slug];
      let lo: number;
      let hi: number | null;
      if (catSpend !== undefined) {
        lo = catSpend;
        hi = catSpend;
      } else if (d.merchantScope === "general") {
        lo = range.min;
        hi = range.max;
      } else {
        // Only total spend is known; category spend is at most the total.
        lo = 0;
        hi = range.max;
      }
      if (lo >= monthlyNeed) {
        evaluations.push({ score: 100, detail: `${d.title}: mức chi tiêu của bạn có thể đáp ứng yêu cầu ${formatVnd(min)} ${periodLabel}` });
      } else if (hi !== null && hi < monthlyNeed) {
        evaluations.push({ score: 0, detail: `${d.title}: cần ${formatVnd(min)} ${periodLabel}, cao hơn mức chi tiêu bạn ước tính` });
        blocking.push(`${d.title} yêu cầu chi tiêu tối thiểu ${formatVnd(min)} ${periodLabel}, có thể bạn không đạt.`);
      } else {
        evaluations.push({ score: 50, detail: `${d.title}: cần ${formatVnd(min)} ${periodLabel}; chưa chắc bạn đạt được` });
        blocking.push(`Cần chi tiêu tối thiểu ${formatVnd(min)} ${periodLabel} để nhận "${d.title}".`);
      }
    }
    if (evaluations.length === 0) {
      dimensions.push({
        key,
        label: DIMENSION_LABELS[key],
        weight: weights[key],
        status: "insufficient",
        score: null,
        explanation: relevant.length === 0 ? "Không có quyền lợi phù hợp với danh mục của bạn để đánh giá điều kiện chi tiêu." : "Chưa đủ thông tin về yêu cầu chi tiêu tối thiểu theo kỳ.",
        details: unknown,
      });
    } else {
      const score = Math.round(evaluations.reduce((a, e) => a + e.score, 0) / evaluations.length);
      dimensions.push({
        key,
        label: DIMENSION_LABELS[key],
        weight: weights[key],
        status: "scored",
        score,
        explanation: `Đánh giá dựa trên ${evaluations.length} quyền lợi có điều kiện chi tiêu đã biết.`,
        details: [...evaluations.map((e) => e.detail), ...unknown],
      });
    }
  }

  // 3. Reward alignment ------------------------------------------------------
  {
    const key: DimensionKey = "rewardAlignment";
    if (answers.rewardPreference === "no_preference") {
      dimensions.push({ key, label: DIMENSION_LABELS[key], weight: weights[key], status: "not_applicable", score: null, explanation: "Bạn không chọn loại ưu đãi ưa thích nên tiêu chí này không được tính.", details: [] });
    } else if (active.length === 0) {
      dimensions.push({ key, label: DIMENSION_LABELS[key], weight: weights[key], status: "insufficient", score: null, explanation: "Chưa có quyền lợi đã xác minh để đánh giá.", details: [] });
    } else {
      const wanted = PREFERENCE_TYPES[answers.rewardPreference];
      const prefLabel = REWARD_PREFERENCES[answers.rewardPreference];
      const inRelevant = relevant.filter((d) => wanted.includes(d.benefitType));
      const inAll = active.filter((d) => wanted.includes(d.benefitType));
      let score: number;
      let explanation: string;
      if (inRelevant.length) {
        score = 100;
        explanation = `Thẻ có ${inRelevant.length} quyền lợi dạng "${prefLabel}" trong danh mục bạn chi tiêu.`;
        reasons.push(`Có ưu đãi dạng ${prefLabel.toLowerCase()} như bạn mong muốn.`);
      } else if (inAll.length) {
        score = 50;
        explanation = `Thẻ có ưu đãi dạng "${prefLabel}" nhưng không thuộc danh mục bạn chọn.`;
      } else {
        score = 0;
        const types = [...new Set(active.map((d) => BENEFIT_TYPE_LABELS[d.benefitType]))].join(", ");
        explanation = `Thẻ chưa có ưu đãi đã xác minh dạng "${prefLabel}". Các dạng hiện có: ${types}.`;
        drawbacks.push(`Không có ưu đãi dạng ${prefLabel.toLowerCase()} đã xác minh.`);
      }
      dimensions.push({ key, label: DIMENSION_LABELS[key], weight: weights[key], status: "scored", score, explanation, details: [] });
    }
  }

  // 4. Annual fee ------------------------------------------------------------
  {
    const key: DimensionKey = "annualFee";
    const pref = FEE_PREFERENCES[answers.feePreference];
    if (card.annualFeeVnd === null) {
      dimensions.push({ key, label: DIMENSION_LABELS[key], weight: weights[key], status: "insufficient", score: null, explanation: "DealHoi chưa có thông tin phí thường niên đã xác minh của thẻ này.", details: [] });
      drawbacks.push("Chưa rõ phí thường niên — hãy kiểm tra với ngân hàng trước khi mở thẻ.");
    } else if (pref.maxVnd === null) {
      dimensions.push({ key, label: DIMENSION_LABELS[key], weight: weights[key], status: "scored", score: 100, explanation: `Phí thường niên ${formatVnd(card.annualFeeVnd)}; bạn cho biết phí không phải ưu tiên.`, details: [] });
    } else if (card.annualFeeVnd <= pref.maxVnd) {
      dimensions.push({ key, label: DIMENSION_LABELS[key], weight: weights[key], status: "scored", score: 100, explanation: `Phí thường niên ${formatVnd(card.annualFeeVnd)} nằm trong ngân sách của bạn.`, details: [] });
      if (card.annualFeeVnd === 0) reasons.push("Miễn phí thường niên.");
    } else if (card.annualFeeWaiverTerms) {
      dimensions.push({ key, label: DIMENSION_LABELS[key], weight: weights[key], status: "scored", score: 40, explanation: `Phí thường niên ${formatVnd(card.annualFeeVnd)} vượt ngân sách, nhưng có điều kiện miễn phí: ${card.annualFeeWaiverTerms}`, details: [] });
      drawbacks.push(`Phí thường niên ${formatVnd(card.annualFeeVnd)} chỉ được miễn nếu đáp ứng điều kiện của ngân hàng.`);
    } else {
      dimensions.push({ key, label: DIMENSION_LABELS[key], weight: weights[key], status: "scored", score: 0, explanation: `Phí thường niên ${formatVnd(card.annualFeeVnd)} vượt ngân sách bạn chọn.`, details: [] });
      drawbacks.push(`Phí thường niên ${formatVnd(card.annualFeeVnd)} cao hơn mức bạn mong muốn.`);
    }
  }

  // Caps and expiring promotions are real restrictions worth surfacing.
  for (const d of relevant) {
    if (d.maximumBenefitVnd !== null && d.capPeriod && d.capPeriod !== "transaction") {
      drawbacks.push(`"${d.title}" giới hạn tối đa ${formatVnd(d.maximumBenefitVnd)} ${CAP_PERIOD_LABELS[d.capPeriod]}.`);
    } else if (d.maximumBenefitVnd === null && d.capIsUnlimited !== true && d.percentage !== null) {
      drawbacks.push(`"${d.title}" chưa rõ mức hoàn/giảm tối đa.`);
    }
    if (d.endDate && d.offerType !== "ongoing") {
      const days = daysBetween(today, d.endDate);
      if (days <= 30) drawbacks.push(`"${d.title}" là khuyến mãi có thời hạn, kết thúc sau ${days} ngày.`);
    }
    if (d.merchantScope === "category_wide") {
      blocking.push(`"${d.title}" áp dụng theo danh mục; một số cửa hàng có thể không được ngân hàng xếp vào danh mục này.`);
    }
  }

  // Aggregate -----------------------------------------------------------------
  const applicable = dimensions.filter((d) => d.status !== "not_applicable");
  const scored = applicable.filter((d) => d.status === "scored");
  const applicableWeight = applicable.reduce((a, d) => a + d.weight, 0);
  const scoredWeight = scored.reduce((a, d) => a + d.weight, 0);
  const categoryDim = dimensions.find((d) => d.key === "categoryAlignment")!;

  let score: number | null = null;
  let reliability: CompatibilityResult["reliability"];
  let reliabilityExplanation: string;
  if (categoryDim.status !== "scored" || scoredWeight === 0) {
    reliability = "insufficient";
    reliabilityExplanation =
      categoryDim.status !== "scored"
        ? `Không thể tính điểm đáng tin cậy: ${categoryDim.explanation}`
        : "Không đủ thông tin để tính điểm.";
  } else {
    score = Math.round(scored.reduce((a, d) => a + d.weight * (d.score as number), 0) / scoredWeight);
    if (scoredWeight < applicableWeight) {
      reliability = "provisional";
      const missing = applicable.filter((d) => d.status !== "scored").map((d) => d.label.toLowerCase());
      reliabilityExplanation = `Điểm tạm tính: thiếu thông tin cho ${missing.join(", ")}. Các tiêu chí thiếu dữ liệu không được tính là phù hợp; trọng số chỉ được chia cho các tiêu chí có dữ liệu.`;
    } else {
      reliability = "reliable";
      reliabilityExplanation = "Tất cả tiêu chí áp dụng đều có dữ liệu đã xác minh.";
    }
  }

  const usableBenefits: UsableBenefit[] = relevant.map((d) => ({
    dealId: d.id,
    title: d.title,
    categoryName: d.merchantScope === "general" ? "Mọi chi tiêu" : d.category.name,
    why: d.merchantScope === "general" ? "Áp dụng cho chi tiêu chung" : `Bạn chi tiêu cho ${d.category.name}`,
  }));

  return {
    cardId: card.id,
    score,
    reliability,
    reliabilityExplanation,
    dimensions,
    reasons: [...new Set(reasons)],
    drawbacks: [...new Set(drawbacks)],
    usableBenefits,
    blockingConditions: [...new Set(blocking)],
    balanceWarning: answers.repayment === "full" ? null : BALANCE_WARNING,
    relevantDealIds: relevant.map((d) => d.id),
    disclaimer: COMPATIBILITY_DISCLAIMER,
  };
}
