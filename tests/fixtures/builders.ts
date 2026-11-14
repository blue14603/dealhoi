import type { CardRecord, DealRecord, SourceRecord } from "@/lib/domain/types";

/** Deterministic fixtures for unit tests. Not real offers. */
export const TODAY = "2026-11-14";

export const fixtureSource: SourceRecord = {
  id: "src-1",
  url: "https://example.com/fixture",
  publisher: "Fixture",
  sourceType: "other",
  sourceExcerpt: null,
  publishedAt: null,
  retrievedAt: "2026-11-01T00:00:00Z",
  verifiedAt: "2026-11-01T00:00:00Z",
  verificationNotes: null,
  isDemo: true,
};

let n = 0;
export function makeDeal(overrides: Partial<DealRecord> = {}): DealRecord {
  n += 1;
  return {
    id: overrides.id ?? `deal-${n}`,
    title: `Deal ${n}`,
    description: "Fixture deal",
    merchant: { id: "m-coffee", slug: "cafe-a", name: "Cafe A" },
    category: { id: "c-coffee", slug: "ca-phe", name: "Cà phê" },
    benefitType: "cashback",
    offerType: "temporary",
    percentage: 10,
    fixedAmountVnd: null,
    maximumBenefitVnd: 100_000,
    capPeriod: "transaction",
    capIsUnlimited: null,
    minimumSpendVnd: 0,
    minimumSpendPeriod: "transaction",
    installmentMonths: null,
    installmentFeeVnd: null,
    eligibilityTerms: null,
    termsAndConditions: null,
    paymentChannel: "both",
    merchantScope: "specific_merchant",
    startDate: "2026-11-01",
    endDate: "2026-12-31",
    verificationStatus: "verified",
    publicationStatus: "published",
    isFeatured: false,
    isDemo: true,
    source: fixtureSource,
    cards: [],
    ...overrides,
  };
}

export function makeCard(overrides: Partial<CardRecord> = {}): CardRecord {
  return {
    id: "card-1",
    slug: "fixture-card",
    name: "Fixture Card",
    bank: { id: "bank-1", slug: "fixture-bank", name: "Fixture Bank", websiteUrl: null, isDemo: true },
    network: "Visa",
    cardTier: "Platinum",
    annualFeeVnd: 500_000,
    annualFeeWaiverTerms: null,
    minimumIncomeVnd: null,
    description: null,
    imageUrl: null,
    officialUrl: null,
    verificationStatus: "verified",
    isActive: true,
    isFeatured: false,
    isDemo: true,
    updatedAt: "2026-11-01T00:00:00Z",
    source: fixtureSource,
    ...overrides,
  };
}
