/**
 * LLM extraction of offers from one promotion page, followed by deterministic
 * validation. The model only turns the bank's own text into fields; anything it
 * says that cannot be found in that text is rejected, never guessed.
 */
import { z } from "zod";
import { extractNumbers } from "@/lib/ai/grounding";
import type { ChatMessage, StructuredCaller } from "@/lib/ai/openai-client";
import { BENEFIT_TYPES, CAP_PERIODS, MERCHANT_SCOPES, OFFER_TYPES, PAYMENT_CHANNELS } from "@/lib/domain/types";
import type { ParsedPromo } from "./types";

export const APPLIES_TO = ["credit_only", "debit_only", "credit_and_debit"] as const;

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

export interface CategoryInfo {
  slug: string;
  name: string;
  aliases?: string[];
}

export function offerJsonSchema(categorySlugs: string[]) {
  const offer = {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      applies_to: { type: "string", enum: [...APPLIES_TO] },
      is_targeted: { type: "boolean" },
      card_keys: { type: "array", items: { type: "string" } },
      benefit_type: { type: "string", enum: [...BENEFIT_TYPES] },
      offer_type: { type: "string", enum: [...OFFER_TYPES] },
      percentage: nullable({ type: "number" }),
      fixed_amount_vnd: nullable({ type: "integer" }),
      maximum_benefit_vnd: nullable({ type: "integer" }),
      cap_period: nullable({ type: "string", enum: [...CAP_PERIODS] }),
      cap_is_unlimited: nullable({ type: "boolean" }),
      minimum_spend_vnd: nullable({ type: "integer" }),
      minimum_spend_period: nullable({ type: "string", enum: [...CAP_PERIODS] }),
      installment_months: nullable({ type: "integer" }),
      installment_fee_vnd: nullable({ type: "integer" }),
      payment_channel: { type: "string", enum: [...PAYMENT_CHANNELS] },
      merchant_scope: { type: "string", enum: [...MERCHANT_SCOPES] },
      merchant_key: nullable({ type: "string" }),
      category_slug: { type: "string", enum: categorySlugs },
      start_date: nullable({ type: "string" }),
      end_date: nullable({ type: "string" }),
      eligibility_terms: nullable({ type: "string" }),
      terms_and_conditions: nullable({ type: "string" }),
      evidence: { type: "string" },
    },
    required: [
      "title", "description", "applies_to", "is_targeted", "card_keys", "benefit_type", "offer_type", "percentage",
      "fixed_amount_vnd", "maximum_benefit_vnd", "cap_period", "cap_is_unlimited", "minimum_spend_vnd",
      "minimum_spend_period", "installment_months", "installment_fee_vnd", "payment_channel", "merchant_scope",
      "merchant_key", "category_slug", "start_date", "end_date", "eligibility_terms", "terms_and_conditions", "evidence",
    ],
  };
  return {
    type: "object",
    additionalProperties: false,
    properties: { offers: { type: "array", items: offer }, notes: nullable({ type: "string" }) },
    required: ["offers", "notes"],
  };
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const OfferSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  applies_to: z.enum(APPLIES_TO),
  is_targeted: z.boolean(),
  card_keys: z.array(z.string()),
  benefit_type: z.enum(BENEFIT_TYPES),
  offer_type: z.enum(OFFER_TYPES),
  percentage: z.number().min(0).max(100).nullable(),
  fixed_amount_vnd: z.number().int().min(0).nullable(),
  maximum_benefit_vnd: z.number().int().min(0).nullable(),
  cap_period: z.enum(CAP_PERIODS).nullable(),
  cap_is_unlimited: z.boolean().nullable(),
  minimum_spend_vnd: z.number().int().min(0).nullable(),
  minimum_spend_period: z.enum(CAP_PERIODS).nullable(),
  installment_months: z.number().int().min(1).max(120).nullable(),
  installment_fee_vnd: z.number().int().min(0).nullable(),
  payment_channel: z.enum(PAYMENT_CHANNELS),
  merchant_scope: z.enum(MERCHANT_SCOPES),
  merchant_key: z.string().nullable(),
  category_slug: z.string(),
  start_date: isoDate.nullable(),
  end_date: isoDate.nullable(),
  eligibility_terms: z.string().nullable(),
  terms_and_conditions: z.string().nullable(),
  evidence: z.string(),
});
export type Offer = z.infer<typeof OfferSchema>;
const ResponseSchema = z.object({ offers: z.array(z.unknown()), notes: z.string().nullable() });

export const SYSTEM_PROMPT = `You extract credit card offers from an official Vietnamese bank promotion page for DealHoi, a card comparison site.

Rules:
- Use ONLY the page text in <page>. Never use outside knowledge. Never guess.
- A page can contain several distinct offers (e.g. installment vs. pay-in-full, credit vs. debit card, different spend tiers with different rewards). Return one offer per distinct reward rule. Spend tiers of the same rule (e.g. 500.000 for orders from 15 triệu, 700.000 from 30 triệu) are separate offers.
- applies_to: whether the offer is for credit cards (thẻ tín dụng), debit cards (thẻ thanh toán / thẻ ghi nợ), or both.
- is_targeted: true when only customers chosen or contacted by the bank can get the offer (e.g. "khách hàng nhận được thông báo", "khách hàng được mời", "khách hàng được lựa chọn"); false when any eligible cardholder can.
- card_keys: the subset of <cards> keys the offer applies to. Empty array if it applies to all listed cards or the page does not say.
- If the page assigns rewards by card number prefix (BIN, "6 số đầu") rather than by card name, keep card_keys empty and write "Chỉ áp dụng cho thẻ có 6 số đầu: <the BINs for this offer>" in eligibility_terms.
- Money is integer VND: "500K" = 500000, "1,5 triệu" = 1500000. Percentages are numbers: "10%" = 10.
- *_vnd fields are Vietnamese đồng only. Points (điểm, U-Point, dặm) are NOT money: for points offers, fixed_amount_vnd and maximum_benefit_vnd must be null; state the number of points in title and description.
- maximum_benefit_vnd is the most a customer can receive. Set cap_period only together with maximum_benefit_vnd.
- Use null for anything the page does not state. minimum_spend_vnd = 0 only if the page says there is no minimum. cap_is_unlimited = true only if the page says there is no cap ("không giới hạn").
- benefit_type: cashback (hoàn tiền), discount (giảm giá / giảm ngay / tặng X đồng off the bill), points (điểm, U-Point, dặm), installment (trả góp 0%), voucher (tặng voucher / mã), travel_perk (phòng chờ, bảo hiểm du lịch, đưa đón), other.
- offer_type: temporary for campaigns with dates, welcome for offers when opening a new card, ongoing for permanent card benefits.
- cap_period / minimum_spend_period: "transaction" for per-order limits ("cho đơn từ", "tối đa ... / giao dịch"), month/quarter/year/campaign for cumulative ones.
- merchant_scope: specific_merchant when tied to named merchant(s) in <merchants> (set merchant_key to its key), category_wide for a spending category, general for any spending.
- category_slug: the best match in <categories> for what the customer buys. "mua-sam-truc-tuyen" only for online marketplaces and online shops (Shopee, Lazada, Tiki…), never for physical stores. Use "chi-tieu-chung" when nothing fits.
- start_date / end_date: YYYY-MM-DD, only if written on the page.
- If the offer only applies on certain days (e.g. "ngày 15, 25 hàng tháng", "21/1, 22/1"), or only to some customer segments (Priority, Private), say so in terms_and_conditions / eligibility_terms, in Vietnamese.
- title and description: short, factual, in Vietnamese, using the page's own figures.
- evidence: copy, word for word, the sentence(s) from the page that state this offer's reward and conditions.
- If the page has no card offer at all, return an empty offers array and explain in notes.`;

export function buildUserMessage(promo: ParsedPromo, today: string, categories: CategoryInfo[] = []): string {
  return [
    `<today>${today}</today>`,
    ...(categories.length
      ? [`<categories>${JSON.stringify(categories.map((c) => ({ slug: c.slug, name: c.name, examples: c.aliases ?? [] })))}</categories>`]
      : []),
    `<cards>${JSON.stringify(promo.creditCards.map((c) => ({ key: c.key, name: c.title })))}</cards>`,
    `<merchants>${JSON.stringify(promo.merchants)}</merchants>`,
    `<bank_categories>${JSON.stringify(promo.categoryHints)}</bank_categories>`,
    `<expiry>${promo.expiryDate ?? "unknown"}</expiry>`,
    `<page url="${promo.url}">\n${promo.text}\n</page>`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Deterministic validation
// ---------------------------------------------------------------------------

/** Normalises text for quote matching: case, links, quotes, brackets and punctuation are ignored. */
function squash(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[“”"'‘’()[\]{}*#…]/g, " ")
    .replace(/[.,;:!?/–—-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when the quote is on the page. A quote may join several passages with
 * "..." or line breaks; each passage of at least a few words must then appear.
 */
export function quoteFound(text: string, quote: string): boolean {
  const page = squash(text);
  const whole = squash(quote);
  if (!whole) return false;
  if (page.includes(whole)) return true;
  const fragments = quote
    .split(/\.{3}|…|\n|(?<=[.;:])\s+/)
    .map(squash)
    .filter((f) => f.split(" ").length >= 3);
  return fragments.length > 0 && fragments.every((f) => page.includes(f));
}

/** Dates written as d/m/yyyy in the text, as YYYY-MM-DD. */
export function datesInText(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
    out.add(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
  }
  return out;
}

export interface ValidationContext {
  promo: ParsedPromo;
  today: string;
}

export function validateOffer(offer: Offer, ctx: ValidationContext): string[] {
  const { promo } = ctx;
  const problems: string[] = [];
  const nums = extractNumbers(promo.text);
  const percents = new Set(nums.percents);
  for (const m of promo.text.matchAll(/(\d+(?:[.,]\d+)?)\s*phần trăm/gi)) percents.add(Number(m[1].replace(",", ".")));
  const amounts = new Set(nums.amounts);

  if (offer.percentage !== null && !percents.has(offer.percentage)) problems.push(`percentage ${offer.percentage}% không có trong trang`);
  const money: [string, number | null][] = [
    ["fixed_amount_vnd", offer.fixed_amount_vnd],
    ["maximum_benefit_vnd", offer.maximum_benefit_vnd],
    ["minimum_spend_vnd", offer.minimum_spend_vnd],
    ["installment_fee_vnd", offer.installment_fee_vnd],
  ];
  for (const [name, v] of money) {
    // 0 is a legitimate "no minimum"/"free" value that the page may state in words.
    if (v !== null && v !== 0 && !amounts.has(v)) problems.push(`${name} ${v} không có trong trang`);
  }
  if (offer.installment_months !== null && !new RegExp(`\\b${offer.installment_months}\\s*tháng`, "i").test(promo.text)) {
    problems.push(`installment_months ${offer.installment_months} không có trong trang`);
  }

  if (!quoteFound(promo.text, offer.evidence)) {
    const shown = offer.evidence.length > 120 ? `${offer.evidence.slice(0, 120)}…` : offer.evidence;
    problems.push(`evidence không trích nguyên văn từ trang: "${shown}"`);
  }

  const known = new Set(promo.creditCards.map((c) => c.key));
  const unknownCards = offer.card_keys.filter((k) => !known.has(k));
  if (unknownCards.length) problems.push(`card_keys không có trong danh sách thẻ: ${unknownCards.join(", ")}`);

  if (offer.merchant_key !== null && !promo.merchants.some((m) => m.key === offer.merchant_key)) {
    problems.push(`merchant_key "${offer.merchant_key}" không có trong danh sách cửa hàng`);
  }
  if (offer.merchant_scope === "specific_merchant" && offer.merchant_key === null) {
    problems.push("ưu đãi riêng tại cửa hàng nhưng không xác định được cửa hàng");
  }

  const pageDates = datesInText(promo.text);
  if (offer.start_date && !pageDates.has(offer.start_date)) problems.push(`start_date ${offer.start_date} không có trong trang`);
  if (offer.end_date && !pageDates.has(offer.end_date) && offer.end_date !== promo.expiryDate) {
    problems.push(`end_date ${offer.end_date} không có trong trang`);
  }
  if (offer.start_date && offer.end_date && offer.start_date > offer.end_date) problems.push("start_date sau end_date");

  if (offer.benefit_type === "cashback" || offer.benefit_type === "discount") {
    if (offer.percentage === null && offer.fixed_amount_vnd === null) problems.push("ưu đãi tiền nhưng không có tỷ lệ hay số tiền");
  }
  return problems;
}

export interface ExtractionResult {
  accepted: Offer[];
  rejected: { offer: unknown; problems: string[] }[];
  skipped: { offer: Offer; reason: string }[];
  notes: string | null;
}

/**
 * Calls the model, validates each offer, and retries once with the problems
 * when any offer fails. Offers that still fail are returned as rejected so a
 * person can enter them by hand.
 */
export async function extractOffers(
  caller: StructuredCaller,
  promo: ParsedPromo,
  ctx: { today: string; categorySlugs: string[]; categories?: CategoryInfo[] },
): Promise<ExtractionResult> {
  const schema = offerJsonSchema(ctx.categorySlugs);
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserMessage(promo, ctx.today, ctx.categories) },
  ];

  let result: ExtractionResult = { accepted: [], rejected: [], skipped: [], notes: null };
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await caller({ messages, schemaName: "bank_offers", jsonSchema: schema });
    const parsed = ResponseSchema.safeParse(raw);
    result = { accepted: [], rejected: [], skipped: [], notes: null };
    if (!parsed.success) {
      result.rejected.push({ offer: raw, problems: ["phản hồi không đúng cấu trúc"] });
    } else {
      result.notes = parsed.data.notes;
      for (const item of parsed.data.offers) {
        const o = OfferSchema.safeParse(item);
        if (!o.success) {
          result.rejected.push({ offer: item, problems: o.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
          continue;
        }
        if (!ctx.categorySlugs.includes(o.data.category_slug)) {
          result.rejected.push({ offer: o.data, problems: [`category_slug "${o.data.category_slug}" không hợp lệ`] });
          continue;
        }
        if (o.data.applies_to === "debit_only") {
          result.skipped.push({ offer: o.data, reason: "chỉ áp dụng thẻ thanh toán (ghi nợ)" });
          continue;
        }
        if (o.data.is_targeted) {
          result.skipped.push({ offer: o.data, reason: "chỉ dành cho khách hàng được ngân hàng mời/thông báo" });
          continue;
        }
        const problems = validateOffer(o.data, { promo, today: ctx.today });
        if (problems.length) result.rejected.push({ offer: o.data, problems });
        else result.accepted.push(o.data);
      }
    }
    if (!result.rejected.length) break;
    if (attempt === 0) {
      messages.push({ role: "assistant", content: JSON.stringify(raw) });
      messages.push({
        role: "user",
        content:
          "Some offers failed validation against the page text:\n" +
          result.rejected.map((r, i) => `${i + 1}. ${r.problems.join("; ")}`).join("\n") +
          "\nReturn the full corrected list. Use null for values the page does not state; copy evidence word for word.",
      });
    }
  }
  return result;
}
