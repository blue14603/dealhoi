import { z } from "zod";
import {
  BENEFIT_TYPES,
  CAP_PERIODS,
  MERCHANT_SCOPES,
  OFFER_TYPES,
  PAYMENT_CHANNELS,
  PUBLICATION_STATUSES,
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
} from "@/lib/domain/types";

const slug = z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug chỉ gồm chữ thường, số và dấu gạch ngang").max(120);
const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "URL không hợp lệ (cần http/https)");
const optText = z.string().trim().max(5000).nullish().transform((v) => (v ? v : null));
const optUrl = httpUrl.nullish().or(z.literal("").transform(() => null)).transform((v) => v ?? null);
const vnd = z.number().int("Số tiền VND phải là số nguyên").min(0, "Số tiền không được âm").max(1_000_000_000_000);
const optVnd = vnd.nullish().transform((v) => (v === undefined ? null : v));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày cần dạng YYYY-MM-DD").refine((v) => !Number.isNaN(Date.parse(v)), "Ngày không hợp lệ");
const optDate = isoDate.nullish().transform((v) => v ?? null);
const timestamp = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Thời gian không hợp lệ");
const optTimestamp = timestamp.nullish().transform((v) => v ?? null);
const bool = (def: boolean) => z.boolean().default(def);

export const BankImportSchema = z.object({
  slug,
  name: z.string().trim().min(1).max(200),
  website_url: optUrl,
  logo_url: optUrl,
  is_demo: bool(false),
});

export const CategoryImportSchema = z.object({
  slug,
  name: z.string().trim().min(1).max(200),
  icon: z.string().trim().max(60).nullish().transform((v) => v ?? null),
  description: optText,
  aliases: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  is_browsable: bool(true),
  sort_order: z.number().int().default(100),
});

export const MerchantImportSchema = z.object({
  slug,
  name: z.string().trim().min(1).max(200),
  category_slug: slug,
  website_url: optUrl,
  logo_url: optUrl,
  aliases: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  is_featured: bool(false),
});

export const SourceImportSchema = z.object({
  url: httpUrl,
  publisher: z.string().trim().min(1).max(200),
  source_type: z.enum(SOURCE_TYPES),
  source_excerpt: optText,
  published_at: optTimestamp,
  retrieved_at: timestamp,
  verified_at: optTimestamp,
  verification_notes: optText,
  is_demo: bool(false),
});

export const CardImportSchema = z.object({
  slug,
  bank_slug: slug,
  name: z.string().trim().min(1).max(200),
  network: z.string().trim().max(60).nullish().transform((v) => v || null),
  card_tier: z.string().trim().max(60).nullish().transform((v) => v || null),
  annual_fee_vnd: optVnd,
  annual_fee_waiver_terms: optText,
  minimum_income_vnd: optVnd,
  description: optText,
  image_url: optUrl,
  official_url: optUrl,
  source_url: optUrl,
  verification_status: z.enum(VERIFICATION_STATUSES).default("draft"),
  is_active: bool(true),
  is_featured: bool(false),
  is_demo: bool(false),
});

/**
 * Facts read from a card page for a card that already exists. Only fields that
 * are still empty on the card are filled; nothing typed in /admin is overwritten.
 */
export const CardDetailsImportSchema = z.object({
  slug,
  source_url: optUrl,
  network: z.string().trim().max(60).nullish().transform((v) => v || null),
  card_tier: z.string().trim().max(60).nullish().transform((v) => v || null),
  annual_fee_vnd: optVnd,
  annual_fee_waiver_terms: optText,
  minimum_income_vnd: optVnd,
  description: optText,
});

export const DealCardImportSchema = z.object({
  card_slug: slug,
  additional_eligibility_terms: optText,
});

export const DealImportSchema = z.object({
  import_key: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(5000),
  merchant_slug: slug.nullish().transform((v) => v ?? null),
  category_slug: slug,
  benefit_type: z.enum(BENEFIT_TYPES),
  offer_type: z.enum(OFFER_TYPES),
  percentage: z.number().min(0, "Tỷ lệ phải từ 0 đến 100").max(100, "Tỷ lệ phải từ 0 đến 100").nullish().transform((v) => v ?? null),
  fixed_amount_vnd: optVnd,
  maximum_benefit_vnd: optVnd,
  cap_period: z.enum(CAP_PERIODS).nullish().transform((v) => v ?? null),
  cap_is_unlimited: z.boolean().nullish().transform((v) => v ?? null),
  minimum_spend_vnd: optVnd,
  minimum_spend_period: z.enum(CAP_PERIODS).nullish().transform((v) => v ?? null),
  installment_months: z.number().int().min(1).max(120).nullish().transform((v) => v ?? null),
  installment_fee_vnd: optVnd,
  eligibility_terms: optText,
  terms_and_conditions: optText,
  payment_channel: z.enum(PAYMENT_CHANNELS).default("unknown"),
  merchant_scope: z.enum(MERCHANT_SCOPES),
  start_date: optDate,
  end_date: optDate,
  source_url: optUrl,
  verification_status: z.enum(VERIFICATION_STATUSES).default("draft"),
  publication_status: z.enum(PUBLICATION_STATUSES).default("draft"),
  is_featured: bool(false),
  is_demo: bool(false),
  cards: z.array(DealCardImportSchema).max(50).default([]),
});

export const ImportBundleSchema = z.object({
  banks: z.array(z.unknown()).default([]),
  categories: z.array(z.unknown()).default([]),
  merchants: z.array(z.unknown()).default([]),
  sources: z.array(z.unknown()).default([]),
  cards: z.array(z.unknown()).default([]),
  card_details: z.array(z.unknown()).default([]),
  deals: z.array(z.unknown()).default([]),
});

export type BankImport = z.infer<typeof BankImportSchema>;
export type CategoryImport = z.infer<typeof CategoryImportSchema>;
export type MerchantImport = z.infer<typeof MerchantImportSchema>;
export type SourceImport = z.infer<typeof SourceImportSchema>;
export type CardImport = z.infer<typeof CardImportSchema>;
export type CardDetailsImport = z.infer<typeof CardDetailsImportSchema>;
export type DealImport = z.infer<typeof DealImportSchema>;

export const ENTITY_ORDER = ["banks", "categories", "merchants", "sources", "cards", "card_details", "deals"] as const;
export type EntityKind = (typeof ENTITY_ORDER)[number];

export const ENTITY_SCHEMAS = {
  banks: BankImportSchema,
  categories: CategoryImportSchema,
  merchants: MerchantImportSchema,
  sources: SourceImportSchema,
  cards: CardImportSchema,
  card_details: CardDetailsImportSchema,
  deals: DealImportSchema,
} as const;
