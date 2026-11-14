export const BENEFIT_TYPES = ["cashback", "discount", "points", "installment", "voucher", "travel_perk", "other"] as const;
export const OFFER_TYPES = ["ongoing", "temporary", "welcome"] as const;
export const CAP_PERIODS = ["transaction", "month", "quarter", "year", "campaign"] as const;
export const PAYMENT_CHANNELS = ["online", "offline", "both", "unknown"] as const;
export const MERCHANT_SCOPES = ["specific_merchant", "category_wide", "general"] as const;
export const VERIFICATION_STATUSES = ["draft", "verified", "needs_review", "rejected"] as const;
export const PUBLICATION_STATUSES = ["draft", "published", "withdrawn"] as const;
export const SOURCE_TYPES = ["official_bank", "official_merchant", "other"] as const;

export type BenefitType = (typeof BENEFIT_TYPES)[number];
export type OfferType = (typeof OFFER_TYPES)[number];
export type CapPeriod = (typeof CAP_PERIODS)[number];
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];
export type MerchantScope = (typeof MERCHANT_SCOPES)[number];
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];

export interface SourceRecord {
  id: string;
  url: string;
  publisher: string;
  sourceType: SourceType;
  sourceExcerpt: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  verifiedAt: string | null;
  verificationNotes: string | null;
  isDemo: boolean;
}

export interface BankRef {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string | null;
  isDemo: boolean;
}

export interface CategoryRef {
  id: string;
  slug: string;
  name: string;
  icon?: string | null;
}

export interface MerchantRef {
  id: string;
  slug: string;
  name: string;
}

export interface DealCardRef {
  cardId: string;
  cardSlug: string;
  cardName: string;
  bankSlug: string;
  bankName: string;
  additionalEligibilityTerms: string | null;
}

export interface DealRecord {
  id: string;
  title: string;
  description: string;
  merchant: MerchantRef | null;
  category: CategoryRef;
  benefitType: BenefitType;
  offerType: OfferType;
  percentage: number | null;
  fixedAmountVnd: number | null;
  maximumBenefitVnd: number | null;
  capPeriod: CapPeriod | null;
  capIsUnlimited: boolean | null;
  /** null = unknown, 0 = explicitly no minimum. */
  minimumSpendVnd: number | null;
  minimumSpendPeriod: CapPeriod | null;
  installmentMonths: number | null;
  installmentFeeVnd: number | null;
  eligibilityTerms: string | null;
  termsAndConditions: string | null;
  paymentChannel: PaymentChannel;
  merchantScope: MerchantScope;
  startDate: string | null;
  endDate: string | null;
  verificationStatus: VerificationStatus;
  publicationStatus: PublicationStatus;
  isFeatured: boolean;
  isDemo: boolean;
  source: SourceRecord | null;
  cards: DealCardRef[];
}

export interface CardRecord {
  id: string;
  slug: string;
  name: string;
  bank: BankRef;
  network: string | null;
  cardTier: string | null;
  annualFeeVnd: number | null;
  annualFeeWaiverTerms: string | null;
  minimumIncomeVnd: number | null;
  description: string | null;
  imageUrl: string | null;
  officialUrl: string | null;
  verificationStatus: VerificationStatus;
  isActive: boolean;
  isFeatured: boolean;
  isDemo: boolean;
  updatedAt: string;
  source: SourceRecord | null;
}

export interface CardWithDeals extends CardRecord {
  deals: DealRecord[];
}
