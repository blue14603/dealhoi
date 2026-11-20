/**
 * Card pages: the LLM reads the card's facts (annual fee, waiver, network,
 * tier, minimum income) and every figure is checked against the page text,
 * as for promotions. Ongoing benefits on the page are extracted separately
 * with the promotion extractor.
 */
import { z } from "zod";
import { extractNumbers } from "@/lib/ai/grounding";
import type { ChatMessage, StructuredCaller } from "@/lib/ai/openai-client";
import { quoteFound } from "./extract";
import type { BankCardRef, ParsedPromo } from "./types";

export interface ParsedCardPage {
  url: string;
  /** Card slug, from the card page URL. */
  slug: string;
  title: string;
  text: string;
  contentHash: string;
}

export const NETWORKS = ["Visa", "Mastercard", "JCB", "American Express", "NAPAS", "UnionPay"] as const;

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

export const CARD_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    card_name: { type: "string" },
    network: nullable({ type: "string", enum: [...NETWORKS] }),
    card_tier: nullable({ type: "string" }),
    annual_fee_vnd: nullable({ type: "integer" }),
    annual_fee_waiver_terms: nullable({ type: "string" }),
    minimum_income_vnd: nullable({ type: "integer" }),
    description: nullable({ type: "string" }),
    evidence: { type: "array", items: { type: "string" } },
  },
  required: [
    "card_name", "network", "card_tier", "annual_fee_vnd", "annual_fee_waiver_terms",
    "minimum_income_vnd", "description", "evidence",
  ],
};

export const CardDetailsSchema = z.object({
  card_name: z.string().min(1),
  network: z.enum(NETWORKS).nullable(),
  card_tier: z.string().nullable(),
  annual_fee_vnd: z.number().int().min(0).nullable(),
  annual_fee_waiver_terms: z.string().nullable(),
  minimum_income_vnd: z.number().int().min(0).nullable(),
  description: z.string().nullable(),
  evidence: z.array(z.string()),
});
export type CardDetails = z.infer<typeof CardDetailsSchema>;

/** Fields copied onto the card record. */
export const CARD_FIELDS = [
  "network",
  "card_tier",
  "annual_fee_vnd",
  "annual_fee_waiver_terms",
  "minimum_income_vnd",
  "description",
] as const;

export const CARD_SYSTEM_PROMPT = `You read an official Vietnamese bank credit card page for DealHoi, a card comparison site, and return the card's basic facts.

Rules:
- Use ONLY the text in <page>. Never use outside knowledge. Never guess: use null for anything not stated.
- card_name: the card's name as the page writes it.
- network: the card network (Visa, Mastercard, …) only if the page or card name says it.
- card_tier: the tier word in the name or text (Classic, Gold, Platinum, Signature, Infinite, World…), else null.
- annual_fee_vnd: the standard yearly fee for the PRIMARY card, in integer VND ("699,000 VND" = 699000). 0 only if the page says the card is free (miễn phí thường niên for everyone). Not supplementary-card fees, not issuance fees.
- annual_fee_waiver_terms: in Vietnamese, the conditions to get the fee waived or refunded (first year, yearly spend, member segments such as Priority/Private), using the page's own figures.
- minimum_income_vnd: the published minimum monthly income in integer VND, only if stated.
- description: one or two factual Vietnamese sentences on what the card is for, from the page.
- evidence: copy, word for word, the sentence(s) that state the annual fee, the waiver terms and the minimum income.`;

function squashLower(s: string): string {
  return s.normalize("NFC").toLowerCase();
}

export function validateCardDetails(d: CardDetails, page: ParsedCardPage): string[] {
  const problems: string[] = [];
  const haystack = `${page.title}\n${page.text}`;
  const amounts = new Set(extractNumbers(haystack).amounts);
  if (d.annual_fee_vnd !== null) {
    if (d.annual_fee_vnd === 0) {
      if (!/miễn phí/i.test(haystack)) problems.push("annual_fee_vnd 0 nhưng trang không ghi miễn phí");
    } else if (!amounts.has(d.annual_fee_vnd)) problems.push(`annual_fee_vnd ${d.annual_fee_vnd} không có trong trang`);
  }
  if (d.minimum_income_vnd !== null && !amounts.has(d.minimum_income_vnd)) {
    problems.push(`minimum_income_vnd ${d.minimum_income_vnd} không có trong trang`);
  }
  const lower = squashLower(haystack);
  if (d.network) {
    const word = d.network === "Mastercard" ? "master" : d.network === "American Express" ? "american express" : d.network.toLowerCase();
    if (!lower.includes(word)) problems.push(`network ${d.network} không có trong trang`);
  }
  if (d.card_tier && !lower.includes(squashLower(d.card_tier))) problems.push(`card_tier "${d.card_tier}" không có trong trang`);
  if ((d.annual_fee_vnd !== null || d.minimum_income_vnd !== null) && d.evidence.length === 0) {
    problems.push("thiếu trích dẫn cho phí thường niên / thu nhập");
  }
  for (const q of d.evidence) {
    if (!quoteFound(haystack, q)) {
      problems.push(`evidence không trích nguyên văn từ trang: "${q.length > 120 ? `${q.slice(0, 120)}…` : q}"`);
    }
  }
  return problems;
}

export interface CardExtraction {
  details: CardDetails | null;
  problems: string[];
}

/** Calls the model once, retrying once with the problems if validation fails. */
export async function extractCardDetails(caller: StructuredCaller, page: ParsedCardPage): Promise<CardExtraction> {
  const messages: ChatMessage[] = [
    { role: "system", content: CARD_SYSTEM_PROMPT },
    { role: "user", content: `<page url="${page.url}" title="${page.title}">\n${page.text}\n</page>` },
  ];
  let problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await caller({ messages, schemaName: "card_details", jsonSchema: CARD_JSON_SCHEMA });
    const parsed = CardDetailsSchema.safeParse(raw);
    problems = parsed.success
      ? validateCardDetails(parsed.data, page)
      : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    if (parsed.success && !problems.length) return { details: parsed.data, problems: [] };
    if (attempt === 0) {
      messages.push({ role: "assistant", content: JSON.stringify(raw) });
      messages.push({
        role: "user",
        content: `Validation against the page failed: ${problems.join("; ")}. Return corrected facts; use null for anything the page does not state and copy evidence word for word.`,
      });
    }
  }
  return { details: null, problems };
}

/** A card page seen as a promotion page, so its ongoing benefits can be extracted like offers. */
export function cardPageAsPromo(page: ParsedCardPage, card: BankCardRef): ParsedPromo {
  return {
    url: page.url,
    title: page.title,
    text: page.text,
    expiryDate: null,
    isCreditCard: true,
    creditCards: [card],
    merchants: [],
    categoryHints: [],
    membership: [],
    documents: [],
    contentHash: page.contentHash,
  };
}

/** Field-by-field differences between two extractions, for change proposals. */
export function cardChanges(before: Partial<CardDetails> | undefined, after: CardDetails): { field: string; from: unknown; to: unknown }[] {
  return CARD_FIELDS.filter((f) => (before?.[f] ?? null) !== (after[f] ?? null)).map((f) => ({
    field: f,
    from: before?.[f] ?? null,
    to: after[f] ?? null,
  }));
}
