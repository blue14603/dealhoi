import type { z } from "zod";
import type { SavingsResult } from "@/lib/domain/savings";
import type { CardRecord, DealRecord } from "@/lib/domain/types";
import { getDealLifecycle } from "@/lib/domain/validity";

/** The limited, verified context handed to the LLM. */
export interface GroundingContext {
  today: string;
  page: Record<string, unknown>;
  purchase_amount_vnd: number | null;
  deals: Record<string, unknown>[];
  cards: Record<string, unknown>[];
  extra?: Record<string, unknown>;
}

export interface ContextIndex {
  context: GroundingContext;
  dealIds: Set<string>;
  sourceIds: Set<string>;
  sources: Map<string, { id: string; url: string; publisher: string; isDemo: boolean }>;
  deals: Map<string, { id: string; title: string }>;
}

export function buildContext(args: {
  today: string;
  page: Record<string, unknown>;
  purchaseAmountVnd: number | null;
  deals: DealRecord[];
  cards: CardRecord[];
  calculations?: Map<string, SavingsResult>;
  extra?: Record<string, unknown>;
}): ContextIndex {
  const sources: ContextIndex["sources"] = new Map();
  const addSource = (s: DealRecord["source"]) => {
    if (s) sources.set(s.id, { id: s.id, url: s.url, publisher: s.publisher, isDemo: s.isDemo });
  };
  const deals = args.deals.map((d) => {
    addSource(d.source);
    const calc = args.calculations?.get(d.id);
    return {
      deal_id: d.id,
      source_id: d.source?.id ?? null,
      is_demo: d.isDemo,
      title: d.title,
      description: d.description,
      status: getDealLifecycle(d, args.today),
      eligible_cards: d.cards.map((c) => ({ card_name: c.cardName, bank_name: c.bankName, additional_terms: c.additionalEligibilityTerms })),
      merchant: d.merchant?.name ?? null,
      category: d.category.name,
      merchant_scope: d.merchantScope,
      benefit_type: d.benefitType,
      offer_type: d.offerType,
      percentage: d.percentage,
      fixed_amount_vnd: d.fixedAmountVnd,
      maximum_benefit_vnd: d.maximumBenefitVnd,
      cap_period: d.capPeriod,
      cap_is_unlimited: d.capIsUnlimited,
      minimum_spend_vnd: d.minimumSpendVnd,
      minimum_spend_period: d.minimumSpendPeriod,
      installment_months: d.installmentMonths,
      installment_fee_vnd: d.installmentFeeVnd,
      payment_channel: d.paymentChannel,
      start_date: d.startDate,
      end_date: d.endDate,
      eligibility_terms: d.eligibilityTerms,
      terms_and_conditions: d.termsAndConditions,
      source_publisher: d.source?.publisher ?? null,
      source_verified_at: d.source?.verifiedAt ?? null,
      calculation: calc
        ? {
            status: calc.status,
            estimated_savings_vnd: calc.savingsVnd,
            upper_bound_vnd: calc.upperBoundVnd,
            is_highest_estimate: calc.isBest,
            notes: calc.notes.map((n) => n.message),
          }
        : null,
    };
  });
  const cards = args.cards.map((c) => {
    addSource(c.source);
    return {
      card_id: c.id,
      source_id: c.source?.id ?? null,
      is_demo: c.isDemo,
      name: c.name,
      bank_name: c.bank.name,
      network: c.network,
      tier: c.cardTier,
      annual_fee_vnd: c.annualFeeVnd,
      annual_fee_waiver_terms: c.annualFeeWaiverTerms,
      minimum_income_vnd: c.minimumIncomeVnd,
      description: c.description,
    };
  });
  const context: GroundingContext = {
    today: args.today,
    page: args.page,
    purchase_amount_vnd: args.purchaseAmountVnd,
    deals,
    cards,
    ...(args.extra ? { extra: args.extra } : {}),
  };
  return {
    context,
    dealIds: new Set(args.deals.map((d) => d.id)),
    sourceIds: new Set(sources.keys()),
    sources,
    deals: new Map(args.deals.map((d) => [d.id, { id: d.id, title: d.title }])),
  };
}

// ---------------------------------------------------------------------------
// Numeric grounding: every percentage and money amount in AI output must
// appear in the supplied context (or in the user's own messages).
// ---------------------------------------------------------------------------

function toNumber(raw: string): number {
  // Vietnamese uses "." for thousands and "," for decimals; also accept "1,500,000".
  const s = raw.trim();
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
  return Number(s.replace(",", "."));
}

export interface ExtractedNumbers {
  percents: number[];
  amounts: number[];
}

/** Extracts percentages and money-like amounts (≥ 1.000) from free text. */
export function extractNumbers(text: string): ExtractedNumbers {
  const percents: number[] = [];
  const amounts: number[] = [];
  // Remove dates (DD/MM/YYYY, YYYY-MM-DD) and times so they are not mistaken for amounts.
  let t = text.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, " ").replace(/\b\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?\b/g, " ");
  t = t.replace(/(\d+(?:[.,]\d+)?)\s*%/g, (_, n: string) => {
    percents.push(toNumber(n));
    return " ";
  });
  t = t.replace(/(\d+(?:[.,]\d+)?)\s*(triệu|tr\b|trieu)/gi, (_, n: string) => {
    amounts.push(Math.round(toNumber(n) * 1_000_000));
    return " ";
  });
  t = t.replace(/(\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn)\b/gi, (_, n: string) => {
    amounts.push(Math.round(toNumber(n) * 1000));
    return " ";
  });
  for (const m of t.matchAll(/\d{1,3}(?:[.,]\d{3})+|\d{4,}/g)) {
    const n = toNumber(m[0]);
    if (n >= 1000 && !(n >= 1900 && n <= 2100 && /^\d{4}$/.test(m[0]))) amounts.push(n);
  }
  return { percents, amounts };
}

function collectAllowed(value: unknown, out: Set<number>) {
  if (typeof value === "number") out.add(value);
  else if (typeof value === "string") {
    const e = extractNumbers(value);
    e.percents.forEach((n) => out.add(n));
    e.amounts.forEach((n) => out.add(n));
  } else if (Array.isArray(value)) value.forEach((v) => collectAllowed(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectAllowed(v, out));
}

export function allowedNumbers(context: GroundingContext, userTexts: string[]): Set<number> {
  const out = new Set<number>();
  collectAllowed(context, out);
  userTexts.forEach((t) => collectAllowed(t, out));
  return out;
}

/** Returns figures in `texts` that do not appear anywhere in the allowed set. */
export function findUnsupportedNumbers(texts: string[], allowed: Set<number>): string[] {
  const bad: string[] = [];
  for (const text of texts) {
    const { percents, amounts } = extractNumbers(text);
    for (const p of percents) if (!allowed.has(p)) bad.push(`${p}%`);
    for (const a of amounts) if (!allowed.has(a)) bad.push(String(a));
  }
  return [...new Set(bad)];
}

export interface ValidationOutcome<T> {
  ok: boolean;
  value?: T;
  problems: string[];
}

/**
 * Validates a model response: schema (Zod), identifier references and numeric
 * grounding. Unknown identifiers are removed; unsupported figures fail validation.
 */
export function validateGroundedResponse<T extends { source_ids: string[]; related_deal_ids: string[] }>(
  raw: unknown,
  schema: z.ZodType<T>,
  index: ContextIndex,
  textFields: (v: T) => string[],
  userTexts: string[],
): ValidationOutcome<T> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, problems: ["schema"] };
  const value = { ...parsed.data };
  const problems: string[] = [];
  const badSources = value.source_ids.filter((id) => !index.sourceIds.has(id));
  const badDeals = value.related_deal_ids.filter((id) => !index.dealIds.has(id));
  if (badSources.length) problems.push(`invalid_source_ids:${badSources.join(",")}`);
  if (badDeals.length) problems.push(`invalid_deal_ids:${badDeals.join(",")}`);
  value.source_ids = [...new Set(value.source_ids.filter((id) => index.sourceIds.has(id)))];
  value.related_deal_ids = [...new Set(value.related_deal_ids.filter((id) => index.dealIds.has(id)))];
  const unsupported = findUnsupportedNumbers(textFields(value), allowedNumbers(index.context, userTexts));
  if (unsupported.length) return { ok: false, value, problems: [...problems, `unsupported_numbers:${unsupported.join(",")}`] };
  return { ok: true, value, problems };
}
