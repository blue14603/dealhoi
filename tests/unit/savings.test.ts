import { describe, expect, it } from "vitest";
import { calculateSavings, compareDeals } from "@/lib/domain/savings";
import { TODAY, makeDeal } from "../fixtures/builders";

const ctx = (amountVnd: number | null, extra: object = {}) => ({ amountVnd, today: TODAY, ...extra });

describe("percentage cashback", () => {
  it("applies the rate when below a per-transaction cap", () => {
    const r = calculateSavings(makeDeal({ percentage: 10, maximumBenefitVnd: 100_000, capPeriod: "transaction" }), ctx(500_000));
    expect(r.status).toBe("exact");
    expect(r.savingsVnd).toBe(50_000);
  });
  it("supports fractional percentages and rounds down to whole VND", () => {
    const r = calculateSavings(makeDeal({ percentage: 0.5, maximumBenefitVnd: null, capPeriod: null, capIsUnlimited: true }), ctx(123_457));
    expect(r.savingsVnd).toBe(617);
    expect(r.status).toBe("exact");
  });
});

describe("cashback caps", () => {
  it("applies a per-transaction cap exactly", () => {
    const r = calculateSavings(makeDeal({ percentage: 20, maximumBenefitVnd: 50_000, capPeriod: "transaction" }), ctx(1_000_000));
    expect(r.savingsVnd).toBe(50_000);
    expect(r.status).toBe("exact");
    expect(r.notes.map((n) => n.code)).toContain("cap_applied");
  });
  it("makes a monthly cap conditional because remaining allowance is unknown", () => {
    const r = calculateSavings(makeDeal({ percentage: 10, maximumBenefitVnd: 100_000, capPeriod: "month" }), ctx(500_000));
    expect(r.status).toBe("conditional");
    expect(r.savingsVnd).toBe(50_000);
    expect(r.notes.map((n) => n.code)).toContain("cap_allowance");
  });
  it("treats a cap with unknown period as conditional", () => {
    const r = calculateSavings(makeDeal({ maximumBenefitVnd: 100_000, capPeriod: null }), ctx(500_000));
    expect(r.status).toBe("conditional");
  });
});

describe("missing or unknown caps", () => {
  it("never treats a missing cap as unlimited", () => {
    const r = calculateSavings(makeDeal({ percentage: 10, maximumBenefitVnd: null, capPeriod: null, capIsUnlimited: null }), ctx(10_000_000));
    expect(r.status).toBe("insufficient_info");
    expect(r.savingsVnd).toBeNull();
    expect(r.upperBoundVnd).toBe(1_000_000);
  });
  it("calculates without a cap only when the source states it is unlimited", () => {
    const r = calculateSavings(makeDeal({ percentage: 10, maximumBenefitVnd: null, capPeriod: null, capIsUnlimited: true }), ctx(10_000_000));
    expect(r.status).toBe("exact");
    expect(r.savingsVnd).toBe(1_000_000);
  });
  it("reports insufficient info when the rate is unknown", () => {
    const r = calculateSavings(makeDeal({ percentage: null, fixedAmountVnd: null }), ctx(500_000));
    expect(r.status).toBe("insufficient_info");
  });
});

describe("fixed-value discounts", () => {
  it("applies a fixed discount", () => {
    const r = calculateSavings(makeDeal({ benefitType: "discount", percentage: null, fixedAmountVnd: 50_000, maximumBenefitVnd: null }), ctx(300_000));
    expect(r.status).toBe("exact");
    expect(r.savingsVnd).toBe(50_000);
  });
  it("never exceeds the purchase amount", () => {
    const r = calculateSavings(makeDeal({ benefitType: "discount", percentage: null, fixedAmountVnd: 50_000, maximumBenefitVnd: null }), ctx(30_000));
    expect(r.savingsVnd).toBe(30_000);
  });
  it("refuses to guess when both a percentage and a fixed amount are present", () => {
    const r = calculateSavings(makeDeal({ percentage: 10, fixedAmountVnd: 50_000 }), ctx(300_000));
    expect(r.status).toBe("insufficient_info");
  });
});

describe("minimum spending thresholds", () => {
  it("excludes offers below a known per-transaction minimum", () => {
    const r = calculateSavings(makeDeal({ minimumSpendVnd: 300_000, minimumSpendPeriod: "transaction" }), ctx(299_999));
    expect(r.status).toBe("not_eligible");
    expect(r.savingsVnd).toBeNull();
  });
  it("is eligible exactly at the minimum", () => {
    const r = calculateSavings(makeDeal({ minimumSpendVnd: 300_000, minimumSpendPeriod: "transaction" }), ctx(300_000));
    expect(r.status).toBe("exact");
    expect(r.savingsVnd).toBe(30_000);
  });
  it("is conditional for cumulative (monthly) minimums the purchase alone does not meet", () => {
    const r = calculateSavings(makeDeal({ minimumSpendVnd: 5_000_000, minimumSpendPeriod: "month" }), ctx(500_000));
    expect(r.status).toBe("conditional");
    expect(r.notes.map((n) => n.code)).toContain("cumulative_minimum");
  });
  it("is conditional when the minimum is unknown (null is not zero)", () => {
    const r = calculateSavings(makeDeal({ minimumSpendVnd: null }), ctx(500_000));
    expect(r.status).toBe("conditional");
    expect(r.notes.map((n) => n.code)).toContain("minimum_unknown");
  });
});

describe("non-comparable benefit types", () => {
  it.each(["points", "voucher", "travel_perk", "other"] as const)("does not convert %s into VND", (benefitType) => {
    const r = calculateSavings(makeDeal({ benefitType }), ctx(1_000_000));
    expect(r.status).toBe("not_comparable");
    expect(r.savingsVnd).toBeNull();
    expect(r.group).toBe("other");
  });
  it("groups installment plans separately", () => {
    const r = calculateSavings(makeDeal({ benefitType: "installment", percentage: null, installmentMonths: 12, installmentFeeVnd: 0 }), ctx(30_000_000));
    expect(r.status).toBe("not_comparable");
    expect(r.group).toBe("installment");
  });
  it("never marks non-comparable benefits as best", () => {
    const out = compareDeals([makeDeal({ id: "p", benefitType: "points" }), makeDeal({ id: "c", percentage: 1 })], ctx(1_000_000));
    expect(out.bestDealIds).toEqual(["c"]);
  });
});

describe("merchant classification", () => {
  it("makes category-wide offers conditional when viewing a specific merchant", () => {
    const r = calculateSavings(makeDeal({ merchantScope: "category_wide", merchant: null }), ctx(500_000, { merchantId: "m-coffee", merchantName: "Cafe A" }));
    expect(r.status).toBe("conditional");
    expect(r.notes.map((n) => n.code)).toContain("merchant_scope");
  });
});

describe("ranking", () => {
  it("highlights the highest comparable savings and excludes expired offers", () => {
    const deals = [
      makeDeal({ id: "low", percentage: 5 }),
      makeDeal({ id: "high", percentage: 15 }),
      makeDeal({ id: "expired", percentage: 50, endDate: "2026-11-01", startDate: "2026-10-01" }),
      makeDeal({ id: "unknowncap", percentage: 40, maximumBenefitVnd: null, capPeriod: null }),
    ];
    const out = compareDeals(deals, ctx(500_000));
    expect(out.bestDealIds).toEqual(["high"]);
    expect(out.bestSavingsVnd).toBe(75_000);
    expect(out.results[0].dealId).toBe("high");
    expect(out.results.find((r) => r.dealId === "expired")?.status).toBe("not_eligible");
    expect(out.results.find((r) => r.dealId === "unknowncap")?.isBest).toBe(false);
  });
  it("marks ties as joint best", () => {
    const out = compareDeals([makeDeal({ id: "a" }), makeDeal({ id: "b" })], ctx(500_000));
    expect(out.bestDealIds.sort()).toEqual(["a", "b"]);
  });
  it("does not pick a best offer without an amount", () => {
    const out = compareDeals([makeDeal({ id: "a" })], ctx(null));
    expect(out.bestDealIds).toEqual([]);
    expect(out.results[0].status).toBe("no_amount");
  });
});
