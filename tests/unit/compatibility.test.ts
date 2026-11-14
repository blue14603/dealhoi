import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING_WEIGHTS, resolveScoringWeights } from "@/config/scoring";
import { scoreCompatibility } from "@/lib/domain/compatibility";
import type { QuizAnswers } from "@/lib/domain/quiz";
import { TODAY, makeCard, makeDeal } from "../fixtures/builders";

const coffee = { id: "c1", slug: "ca-phe", name: "Cà phê" };
const shopping = { id: "c2", slug: "mua-sam-truc-tuyen", name: "Mua sắm trực tuyến" };
const travel = { id: "c3", slug: "du-lich", name: "Du lịch" };
const names = { "ca-phe": "Cà phê", "mua-sam-truc-tuyen": "Mua sắm trực tuyến", "du-lich": "Du lịch" };

const answers = (o: Partial<QuizAnswers> = {}): QuizAnswers => ({
  monthlySpend: "10_20m",
  categories: ["ca-phe", "mua-sam-truc-tuyen"],
  categorySpend: {},
  rewardPreference: "cashback",
  feePreference: "up_to_1m",
  repayment: "full",
  ...o,
});

const deals = [
  makeDeal({ id: "d-coffee", category: coffee, minimumSpendVnd: 0, offerType: "ongoing", startDate: null, endDate: null }),
  makeDeal({ id: "d-shop", category: shopping, minimumSpendVnd: 3_000_000, minimumSpendPeriod: "month", offerType: "ongoing", startDate: null, endDate: null }),
];

const run = (a: QuizAnswers, d = deals, card = makeCard()) =>
  scoreCompatibility({ card, deals: d, answers: a, weights: DEFAULT_SCORING_WEIGHTS, today: TODAY, categoryNames: names });

describe("compatibility scoring", () => {
  it("scores a full match as 100 and reliable", () => {
    const r = run(answers({ categorySpend: { "ca-phe": 500_000, "mua-sam-truc-tuyen": 4_000_000 } }));
    expect(r.reliability).toBe("reliable");
    expect(r.score).toBe(100);
  });

  it("gives partial credit when a monthly minimum cannot be confirmed from total spend alone", () => {
    const r = run(answers());
    expect(r.dimensions.find((d) => d.key === "spendingConditions")?.score).toBe(75);
    expect(r.dimensions.every((d) => d.status === "scored")).toBe(true);
  });

  it("applies the 40/25/20/15 weights", () => {
    // category 50 (1 of 2), spending 100, reward 100, fee 0
    const r = run(answers({ categories: ["ca-phe", "du-lich"], feePreference: "free" }));
    const byKey = Object.fromEntries(r.dimensions.map((d) => [d.key, d.score]));
    expect(byKey).toMatchObject({ categoryAlignment: 50, spendingConditions: 100, rewardAlignment: 100, annualFee: 0 });
    expect(r.score).toBe(Math.round((40 * 50 + 25 * 100 + 20 * 100 + 15 * 0) / 100));
  });

  it("weights category alignment by spend when spend amounts are given", () => {
    const r = run(answers({ categories: ["ca-phe", "du-lich"], categorySpend: { "ca-phe": 1_000_000, "du-lich": 3_000_000 } }));
    expect(r.dimensions.find((d) => d.key === "categoryAlignment")?.score).toBe(25);
  });

  it("does not treat unknown annual fee as a perfect match", () => {
    const r = run(answers({ categorySpend: { "ca-phe": 500_000, "mua-sam-truc-tuyen": 4_000_000 } }), deals, makeCard({ annualFeeVnd: null }));
    const fee = r.dimensions.find((d) => d.key === "annualFee")!;
    expect(fee.status).toBe("insufficient");
    expect(fee.score).toBeNull();
    expect(r.reliability).toBe("provisional");
    // Score is computed only over dimensions with data (40+25+20 = 85 weight).
    expect(r.score).toBe(100);
    expect(r.drawbacks.join(" ")).toMatch(/Chưa rõ phí thường niên/);
  });

  it("excludes the reward dimension when there is no preference", () => {
    const r = run(answers({ rewardPreference: "no_preference" }));
    expect(r.dimensions.find((d) => d.key === "rewardAlignment")?.status).toBe("not_applicable");
    expect(r.reliability).toBe("reliable");
  });

  it("gives partial credit when a fee above budget can be waived", () => {
    const r = run(answers({ feePreference: "free" }), deals, makeCard({ annualFeeVnd: 1_000_000, annualFeeWaiverTerms: "Chi tiêu 50 triệu/năm" }));
    expect(r.dimensions.find((d) => d.key === "annualFee")?.score).toBe(40);
  });

  it("flags monthly minimum spend the user cannot reach", () => {
    const r = run(answers({ categorySpend: { "mua-sam-truc-tuyen": 1_000_000 } }));
    const sp = r.dimensions.find((d) => d.key === "spendingConditions")!;
    expect(sp.score).toBe(50); // coffee 100 (no minimum), shopping 0
    expect(r.blockingConditions.length).toBeGreaterThan(0);
  });

  it("returns no score when the card has no verified active benefits", () => {
    const expired = deals.map((d) => ({ ...d, offerType: "temporary" as const, startDate: "2026-01-01", endDate: "2026-02-01" }));
    const r = run(answers(), expired);
    expect(r.score).toBeNull();
    expect(r.reliability).toBe("insufficient");
  });

  it("returns no score when the user selects no categories", () => {
    const r = run(answers({ categories: [] }));
    expect(r.score).toBeNull();
  });

  it("warns separately about carrying a balance without changing the score", () => {
    const full = run(answers());
    const partial = run(answers({ repayment: "partial" }));
    expect(full.balanceWarning).toBeNull();
    expect(partial.balanceWarning).toMatch(/lãi suất/);
    expect(partial.score).toBe(full.score);
  });

  it("supports configurable weights", () => {
    expect(resolveScoringWeights('{"categoryAlignment":100,"spendingConditions":0,"rewardAlignment":0,"annualFee":0}').categoryAlignment).toBe(100);
    expect(resolveScoringWeights("not json")).toEqual(DEFAULT_SCORING_WEIGHTS);
    const r = scoreCompatibility({
      card: makeCard(), deals, today: TODAY, categoryNames: names,
      answers: answers({ categories: ["ca-phe", "du-lich"] }),
      weights: { categoryAlignment: 100, spendingConditions: 0, rewardAlignment: 0, annualFee: 0 },
    });
    expect(r.score).toBe(50);
  });

  it("matches general (all-spend) benefits to any category", () => {
    const general = [makeDeal({ id: "g", category: travel, merchantScope: "general", merchant: null, offerType: "ongoing", startDate: null, endDate: null })];
    const r = run(answers({ categories: ["ca-phe"] }), general);
    expect(r.dimensions.find((d) => d.key === "categoryAlignment")?.score).toBe(100);
  });
});
