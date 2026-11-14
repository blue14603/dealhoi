import { CAP_PERIOD_LABELS, formatPercent, formatVnd } from "./format";
import type { DealRecord } from "./types";
import { getDealLifecycle, type DealLifecycle } from "./validity";

/**
 * Deterministic savings engine.
 *
 * Principles:
 * - Unknown values stay unknown: a missing cap is never "unlimited", a missing
 *   minimum spend is never "no minimum", a missing fee is never zero.
 * - Only monetary cashback/discounts are compared. Points, installments,
 *   vouchers, travel perks and "other" benefits are never converted to an
 *   invented VND value.
 * - Offers are never combined (stacking rules are unknown).
 */

export type SavingsStatus =
  /** Calculated with all required information known. */
  | "exact"
  /** Calculated, but depends on an unverifiable condition (remaining allowance, merchant classification…). */
  | "conditional"
  /** A figure cannot be calculated reliably (e.g. cap unknown). */
  | "insufficient_info"
  /** Known to be ineligible (inactive, below a known per-transaction minimum…). */
  | "not_eligible"
  /** Non-monetary or installment benefit: shown separately, never ranked. */
  | "not_comparable"
  /** Monetary benefit but no purchase amount entered yet. */
  | "no_amount";

export interface SavingsNote {
  code: string;
  message: string;
}

export interface SavingsResult {
  dealId: string;
  status: SavingsStatus;
  lifecycle: DealLifecycle;
  /** Estimated savings in VND (exact or conditional only). */
  savingsVnd: number | null;
  /** Theoretical maximum when the reliable figure cannot be determined. */
  upperBoundVnd: number | null;
  notes: SavingsNote[];
  isBest: boolean;
  group: "monetary" | "installment" | "other";
}

export interface SavingsContext {
  amountVnd: number | null;
  today: string;
  /** When the user is looking at a specific merchant. */
  merchantId?: string | null;
  merchantName?: string | null;
}

const MONETARY_TYPES = new Set(["cashback", "discount"]);

export function isMonetaryBenefit(deal: Pick<DealRecord, "benefitType">): boolean {
  return MONETARY_TYPES.has(deal.benefitType);
}

function note(code: string, message: string): SavingsNote {
  return { code, message };
}

/** Downgrades `exact` to `conditional`; leaves weaker statuses unchanged. */
function weaken(status: SavingsStatus): SavingsStatus {
  return status === "exact" ? "conditional" : status;
}

const LIFECYCLE_EXCLUSION: Record<Exclude<DealLifecycle, "active">, string> = {
  expired: "Ưu đãi đã hết hạn.",
  upcoming: "Ưu đãi chưa bắt đầu.",
  withdrawn: "Ưu đãi đã bị ngân hàng dừng hoặc rút lại.",
  unverified: "Ưu đãi chưa được xác minh.",
  validity_unknown: "Chưa xác minh được thời hạn của khuyến mãi này.",
};

export function calculateSavings(deal: DealRecord, ctx: SavingsContext): SavingsResult {
  const lifecycle = getDealLifecycle(deal, ctx.today);
  const group: SavingsResult["group"] = isMonetaryBenefit(deal)
    ? "monetary"
    : deal.benefitType === "installment"
      ? "installment"
      : "other";
  const base = { dealId: deal.id, lifecycle, group, isBest: false } as const;
  const notes: SavingsNote[] = [];

  if (lifecycle !== "active") {
    return { ...base, status: "not_eligible", savingsVnd: null, upperBoundVnd: null, notes: [note(`lifecycle_${lifecycle}`, LIFECYCLE_EXCLUSION[lifecycle])] };
  }

  if (group !== "monetary") {
    if (group === "installment") {
      notes.push(
        note(
          "installment",
          deal.installmentMonths
            ? `Trả góp ${deal.installmentMonths} tháng${deal.installmentFeeVnd === null ? ", phí chuyển đổi chưa rõ" : deal.installmentFeeVnd === 0 ? ", phí chuyển đổi 0 ₫" : `, phí chuyển đổi ${formatVnd(deal.installmentFeeVnd)}`}. Trả góp không phải là khoản tiết kiệm.`
            : "Chưa rõ kỳ hạn trả góp.",
        ),
      );
    } else {
      notes.push(note("not_comparable", "Ưu đãi không quy đổi trực tiếp ra tiền nên không được so sánh bằng số tiền tiết kiệm."));
    }
    if (ctx.amountVnd !== null && deal.minimumSpendVnd !== null && deal.minimumSpendVnd > 0 && deal.minimumSpendPeriod === "transaction" && ctx.amountVnd < deal.minimumSpendVnd) {
      return { ...base, status: "not_eligible", savingsVnd: null, upperBoundVnd: null, notes: [...notes, note("below_minimum", `Giao dịch tối thiểu ${formatVnd(deal.minimumSpendVnd)}.`)] };
    }
    return { ...base, status: "not_comparable", savingsVnd: null, upperBoundVnd: null, notes };
  }

  let status: SavingsStatus = "exact";

  // Merchant classification: a category-wide/general benefit may not apply at a specific merchant.
  if (ctx.merchantId && deal.merchantScope !== "specific_merchant") {
    status = weaken(status);
    notes.push(
      note(
        "merchant_scope",
        `Đây là ưu đãi ${deal.merchantScope === "general" ? "chi tiêu chung" : "theo danh mục"}; việc áp dụng tại ${ctx.merchantName ?? "cửa hàng này"} phụ thuộc cách ngân hàng phân loại giao dịch (mã MCC) và chưa được xác nhận.`,
      ),
    );
  }

  // Minimum spend.
  if (deal.minimumSpendVnd === null) {
    status = weaken(status);
    notes.push(note("minimum_unknown", "Chưa rõ yêu cầu chi tiêu tối thiểu."));
  } else if (deal.minimumSpendVnd > 0 && ctx.amountVnd !== null && ctx.amountVnd < deal.minimumSpendVnd) {
    if (deal.minimumSpendPeriod === "transaction") {
      return {
        ...base,
        status: "not_eligible",
        savingsVnd: null,
        upperBoundVnd: null,
        notes: [note("below_minimum", `Chưa đạt giá trị giao dịch tối thiểu ${formatVnd(deal.minimumSpendVnd)}.`)],
      };
    }
    status = weaken(status);
    notes.push(
      note(
        "cumulative_minimum",
        deal.minimumSpendPeriod
          ? `Cần tổng chi tiêu tối thiểu ${formatVnd(deal.minimumSpendVnd)} ${CAP_PERIOD_LABELS[deal.minimumSpendPeriod]}; giao dịch này chưa đủ nếu chỉ tính riêng.`
          : `Yêu cầu chi tiêu tối thiểu ${formatVnd(deal.minimumSpendVnd)} (chưa rõ tính theo giao dịch hay theo kỳ).`,
      ),
    );
  }

  if (ctx.amountVnd === null) {
    return { ...base, status: "no_amount", savingsVnd: null, upperBoundVnd: null, notes };
  }
  const amount = ctx.amountVnd;

  const hasPct = deal.percentage !== null;
  const hasFixed = deal.fixedAmountVnd !== null;
  if (hasPct && hasFixed) {
    return { ...base, status: "insufficient_info", savingsVnd: null, upperBoundVnd: null, notes: [...notes, note("ambiguous_value", "Ưu đãi có cả tỷ lệ phần trăm và số tiền cố định; chưa rõ cách áp dụng.")] };
  }
  if (!hasPct && !hasFixed) {
    return { ...base, status: "insufficient_info", savingsVnd: null, upperBoundVnd: null, notes: [...notes, note("value_unknown", "Chưa có mức ưu đãi cụ thể để tính.")] };
  }

  if (hasFixed) {
    const value = Math.min(deal.fixedAmountVnd as number, amount);
    if (value < (deal.fixedAmountVnd as number)) {
      notes.push(note("fixed_capped_by_amount", "Mức giảm không vượt quá giá trị giao dịch."));
    }
    return { ...base, status, savingsVnd: value, upperBoundVnd: null, notes };
  }

  const pct = deal.percentage as number;
  const raw = Math.floor((amount * pct) / 100 + 1e-9);

  if (deal.maximumBenefitVnd !== null) {
    const capped = Math.min(raw, deal.maximumBenefitVnd);
    if (raw > deal.maximumBenefitVnd) {
      notes.push(note("cap_applied", `Đã áp dụng mức tối đa ${formatVnd(deal.maximumBenefitVnd)}${deal.capPeriod ? ` ${CAP_PERIOD_LABELS[deal.capPeriod]}` : ""} (tính theo ${formatPercent(pct)} là ${formatVnd(raw)}).`));
    }
    if (deal.capPeriod === "transaction") {
      // Cap resets per transaction: fully determined.
    } else if (deal.capPeriod) {
      status = weaken(status);
      notes.push(note("cap_allowance", `Giả định bạn chưa dùng hạn mức ${formatVnd(deal.maximumBenefitVnd)} ${CAP_PERIOD_LABELS[deal.capPeriod]}; DealHoi không biết hạn mức còn lại của bạn.`));
    } else {
      status = weaken(status);
      notes.push(note("cap_period_unknown", "Chưa rõ mức tối đa được tính theo giao dịch hay theo kỳ."));
    }
    return { ...base, status, savingsVnd: capped, upperBoundVnd: null, notes };
  }

  if (deal.capIsUnlimited === true) {
    return { ...base, status, savingsVnd: raw, upperBoundVnd: null, notes };
  }

  return {
    ...base,
    status: "insufficient_info",
    savingsVnd: null,
    upperBoundVnd: raw,
    notes: [...notes, note("cap_unknown", `Chưa rõ mức hoàn/giảm tối đa. Theo tỷ lệ ${formatPercent(pct)}, con số lý thuyết là ${formatVnd(raw)} nhưng thực tế có thể thấp hơn.`)],
  };
}

const STATUS_ORDER: Record<SavingsStatus, number> = {
  exact: 0,
  conditional: 0,
  no_amount: 1,
  insufficient_info: 2,
  not_comparable: 3,
  not_eligible: 4,
};

export interface ComparisonOutcome {
  results: SavingsResult[];
  bestDealIds: string[];
  bestSavingsVnd: number | null;
}

/**
 * Calculates and ranks offers. Only exact/conditional monetary estimates take part
 * in "best" selection; ties are all marked best. Offers are never combined.
 */
export function compareDeals(deals: DealRecord[], ctx: SavingsContext): ComparisonOutcome {
  const results = deals.map((d) => calculateSavings(d, ctx));
  const comparable = results.filter((r) => (r.status === "exact" || r.status === "conditional") && (r.savingsVnd ?? 0) > 0);
  const bestSavingsVnd = comparable.length ? Math.max(...comparable.map((r) => r.savingsVnd as number)) : null;
  const bestDealIds = bestSavingsVnd === null ? [] : comparable.filter((r) => r.savingsVnd === bestSavingsVnd).map((r) => r.dealId);
  for (const r of results) r.isBest = bestDealIds.includes(r.dealId);

  const index = new Map(deals.map((d, i) => [d.id, i]));
  results.sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    const v = (b.savingsVnd ?? -1) - (a.savingsVnd ?? -1);
    if (v !== 0) return v;
    if (a.status !== b.status) return a.status === "exact" ? -1 : 1;
    return (index.get(a.dealId) ?? 0) - (index.get(b.dealId) ?? 0);
  });
  return { results, bestDealIds, bestSavingsVnd };
}

/** Human readable advertised value, e.g. "Hoàn 10% (tối đa 100.000 ₫ mỗi tháng)". */
export function describeAdvertisedValue(deal: DealRecord): string {
  if (deal.percentage !== null) return formatPercent(deal.percentage);
  if (deal.fixedAmountVnd !== null) return formatVnd(deal.fixedAmountVnd);
  if (deal.benefitType === "installment" && deal.installmentMonths) return `${deal.installmentMonths} tháng`;
  return "—";
}

export function describeCap(deal: DealRecord): string {
  if (deal.maximumBenefitVnd !== null) {
    return `${formatVnd(deal.maximumBenefitVnd)}${deal.capPeriod ? ` ${CAP_PERIOD_LABELS[deal.capPeriod]}` : ""}`;
  }
  if (deal.capIsUnlimited === true) return "Không giới hạn";
  if (deal.percentage === null) return "Không áp dụng";
  return "Chưa rõ";
}

export function describeMinimumSpend(deal: DealRecord): string {
  if (deal.minimumSpendVnd === null) return "Chưa rõ";
  if (deal.minimumSpendVnd === 0) return "Không yêu cầu";
  return `${formatVnd(deal.minimumSpendVnd)}${deal.minimumSpendPeriod ? ` ${CAP_PERIOD_LABELS[deal.minimumSpendPeriod]}` : ""}`;
}
