import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { config } from "@/lib/config";
import type { CompatibilityResult } from "@/lib/domain/compatibility";
import { compareDeals, type SavingsResult } from "@/lib/domain/savings";
import { normalizeText } from "@/lib/domain/text";
import type { CardRecord, DealRecord } from "@/lib/domain/types";
import { getDealLifecycle, todayInVietnam } from "@/lib/domain/validity";
import { groundedCall } from "@/lib/ai/grounded-call";
import { buildContext, type ContextIndex } from "@/lib/ai/grounding";
import { AiInvalidResponseError, createStructuredCaller, type ChatMessage, type StructuredCaller } from "@/lib/ai/openai-client";
import { CHAT_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { CHAT_JSON_SCHEMA, ChatResponseSchema, SUMMARY_JSON_SCHEMA, SummaryResponseSchema, type SummaryResponse } from "@/lib/ai/schemas";
import { getCardBySlug, getCardsByIds, listCards, listDeals, listMerchants } from "./catalog";
import { resolveTarget } from "./comparison";

export const NO_VERIFIED_DATA_MESSAGE = "DealHoi chưa có thông tin ưu đãi đã được xác minh cho nội dung này.";
export const AI_UNAVAILABLE_MESSAGE = "DealHoi đang gặp sự cố. Bạn vui lòng thử lại sau.";

let callerOverride: StructuredCaller | null = null;
/** Test hook: replace the model caller with a deterministic mock. */
export function setStructuredCallerForTests(caller: StructuredCaller | null) {
  callerOverride = caller;
}
function caller(): StructuredCaller {
  return callerOverride ?? createStructuredCaller({ ...config.ai });
}

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120);

export const PageContextSchema = z.object({
  page: z.enum(["home", "compare", "deals", "card", "quiz"]).default("home"),
  merchantSlug: slug.optional(),
  categorySlug: slug.optional(),
  cardSlug: slug.optional(),
  dealIds: z.array(z.uuid()).max(30).optional(),
  purchaseAmountVnd: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
});
export type PageContext = z.infer<typeof PageContextSchema>;

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1, "Vui lòng nhập câu hỏi").max(500, "Câu hỏi tối đa 500 ký tự"),
  context: PageContextSchema.default({ page: "home" }),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(8)
    .default([]),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export interface ChatReply {
  answer: string;
  sources: { id: string; url: string; publisher: string; isDemo: boolean }[];
  relatedDeals: { id: string; title: string }[];
  suggestedQuestions: string[];
  uncertainties: string[];
  grounded: boolean;
}

const MAX_DEALS = 25;
const MAX_CARDS = 8;

function dedupe<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

/** Identifies merchants and cards named in the question (accent-insensitive). */
async function mentionedEntities(message: string) {
  const text = ` ${normalizeText(message)} `;
  const [merchants, cards] = await Promise.all([listMerchants(), listCards()]);
  const hit = (term: string) => {
    const t = normalizeText(term);
    return t.length >= 3 && text.includes(t);
  };
  return {
    merchants: merchants.filter((m) => hit(m.name) || hit(m.slug.replace(/-/g, " "))).slice(0, 2),
    cards: cards.filter((c) => hit(c.name.replace(/\(.*?\)/g, "")) || hit(c.slug.replace(/-/g, " "))).slice(0, 3),
  };
}

/** Server-side retrieval of the limited verified records relevant to a question. */
export async function retrieveForChat(ctx: PageContext, message: string) {
  const today = todayInVietnam();
  let deals: DealRecord[] = [];
  let cards: CardRecord[] = [];
  const target = await resolveTarget({ merchantSlug: ctx.merchantSlug, categorySlug: ctx.categorySlug });
  if (target.merchant) deals.push(...(await listDeals({ forMerchant: { id: target.merchant.id, categoryId: target.merchant.category.id } })));
  else if (target.category) deals.push(...(await listDeals({ forCategory: { id: target.category.id } })));
  if (ctx.cardSlug) {
    const card = await getCardBySlug(ctx.cardSlug);
    if (card) {
      cards.push(card);
      deals.push(...card.deals);
    }
  }
  if (ctx.dealIds?.length) deals.push(...(await listDeals({ ids: ctx.dealIds })));

  const mentioned = await mentionedEntities(message);
  for (const m of mentioned.merchants) {
    if (m.id !== target.merchant?.id) deals.push(...(await listDeals({ forMerchant: { id: m.id, categoryId: m.category.id } })));
  }
  for (const c of mentioned.cards) {
    if (!cards.some((x) => x.id === c.id)) {
      const full = await getCardBySlug(c.slug);
      if (full) {
        cards.push(full);
        deals.push(...full.deals);
      }
    }
  }

  // Prefer active deals, then the rest, within a fixed budget.
  deals = dedupe(deals);
  deals.sort((a, b) => Number(getDealLifecycle(b, today) === "active") - Number(getDealLifecycle(a, today) === "active"));
  deals = deals.slice(0, MAX_DEALS);
  const cardIds = [...new Set(deals.flatMap((d) => d.cards.map((c) => c.cardId)))].filter((id) => !cards.some((c) => c.id === id));
  cards = dedupe([...cards, ...(await getCardsByIds(cardIds.slice(0, MAX_CARDS)))]).slice(0, MAX_CARDS);

  const amount = ctx.purchaseAmountVnd ?? null;
  const active = deals.filter((d) => getDealLifecycle(d, today) === "active");
  const outcome = compareDeals(active, { amountVnd: amount, today, merchantId: target.merchant?.id ?? null, merchantName: target.merchant?.name ?? null });
  const calculations = new Map<string, SavingsResult>(outcome.results.map((r) => [r.dealId, r]));

  const index = buildContext({
    today,
    page: {
      page: ctx.page,
      merchant: target.merchant?.name ?? null,
      category: target.category?.name ?? null,
      card: ctx.cardSlug ? (cards.find((c) => c.slug === ctx.cardSlug)?.name ?? null) : null,
    },
    purchaseAmountVnd: amount,
    deals,
    cards,
    calculations,
  });
  return { index, deals, cards };
}

function toReply(index: ContextIndex, v: z.infer<typeof ChatResponseSchema>): ChatReply {
  return {
    answer: v.answer,
    sources: v.source_ids.map((id) => index.sources.get(id)!).filter(Boolean),
    relatedDeals: v.related_deal_ids.map((id) => index.deals.get(id)!).filter(Boolean),
    suggestedQuestions: v.suggested_questions.slice(0, 3),
    uncertainties: v.uncertainties,
    grounded: true,
  };
}

export async function answerChat(req: ChatRequest): Promise<ChatReply> {
  const { index } = await retrieveForChat(req.context, req.message);
  if (index.dealIds.size === 0 && index.context.cards.length === 0) {
    return { answer: NO_VERIFIED_DATA_MESSAGE, sources: [], relatedDeals: [], suggestedQuestions: [], uncertainties: [], grounded: true };
  }
  const conversation: ChatMessage[] = [
    ...req.history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: req.message },
  ];
  const userTexts = [req.message, ...req.history.filter((h) => h.role === "user").map((h) => h.content)];
  try {
    const { value } = await groundedCall({
      caller: caller(),
      systemPrompt: CHAT_SYSTEM_PROMPT,
      index,
      conversation,
      schemaName: "dealhoi_chat_response",
      jsonSchema: CHAT_JSON_SCHEMA,
      schema: ChatResponseSchema,
      textFields: (v) => [v.answer, ...v.uncertainties],
      userTexts,
    });
    return toReply(index, value);
  } catch (e) {
    if (e instanceof AiInvalidResponseError) {
      // Never show an answer that failed validation.
      return {
        answer:
          "Mình chưa thể tạo câu trả lời đáng tin cậy chỉ từ dữ liệu đã xác minh. Bạn vui lòng xem bảng so sánh và nguồn chính thức bên dưới, hoặc đặt câu hỏi cụ thể hơn.",
        sources: [...index.sources.values()].slice(0, 5),
        relatedDeals: [],
        suggestedQuestions: [],
        uncertainties: [],
        grounded: false,
      };
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Summarization
// ---------------------------------------------------------------------------

export const SummarizeRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("card"), cardSlug: slug }),
  z.object({
    kind: z.literal("comparison"),
    merchantSlug: slug.optional(),
    categorySlug: slug.optional(),
    purchaseAmountVnd: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
  }),
]);
export type SummarizeRequest = z.infer<typeof SummarizeRequestSchema>;

export interface SummaryReply extends SummaryResponse {
  sources: { id: string; url: string; publisher: string; isDemo: boolean }[];
}

const summaryCache = new Map<string, { at: number; value: SummaryReply }>();
const SUMMARY_TTL_MS = 60 * 60 * 1000;

async function summarizeIndex(index: ContextIndex, instruction: string): Promise<SummaryReply> {
  const key = createHash("sha256").update(instruction).update(JSON.stringify(index.context)).digest("hex");
  const cached = summaryCache.get(key);
  if (cached && Date.now() - cached.at < SUMMARY_TTL_MS) return cached.value;
  const { value } = await groundedCall({
    caller: caller(),
    systemPrompt: SUMMARY_SYSTEM_PROMPT,
    index,
    conversation: [{ role: "user", content: instruction }],
    schemaName: "dealhoi_summary",
    jsonSchema: SUMMARY_JSON_SCHEMA,
    schema: SummaryResponseSchema,
    textFields: (v) => [v.summary, ...v.highlighted_benefits, ...v.key_differences, ...v.important_restrictions, ...v.uncertainties],
    userTexts: [],
  });
  const reply: SummaryReply = { ...value, sources: value.source_ids.map((id) => index.sources.get(id)!).filter(Boolean) };
  if (summaryCache.size > 200) summaryCache.delete(summaryCache.keys().next().value as string);
  summaryCache.set(key, { at: Date.now(), value: reply });
  return reply;
}

export class NoVerifiedDataError extends Error {}

export async function summarize(req: SummarizeRequest): Promise<SummaryReply> {
  const today = todayInVietnam();
  if (req.kind === "card") {
    const card = await getCardBySlug(req.cardSlug);
    if (!card) throw new NoVerifiedDataError();
    const index = buildContext({ today, page: { page: "card", card: card.name }, purchaseAmountVnd: null, deals: card.deals, cards: [card] });
    return summarizeIndex(index, "Tóm tắt thẻ này: quyền lợi chính, điều kiện quan trọng, phí, và kiểu người dùng có thể hưởng lợi. Phân biệt quyền lợi thường xuyên với khuyến mãi có thời hạn.");
  }
  const target = await resolveTarget({ merchantSlug: req.merchantSlug, categorySlug: req.categorySlug });
  if (!target.merchant && !target.category) throw new NoVerifiedDataError();
  const deals = (
    target.merchant
      ? await listDeals({ forMerchant: { id: target.merchant.id, categoryId: target.merchant.category.id } })
      : await listDeals({ forCategory: { id: target.category!.id } })
  ).filter((d) => getDealLifecycle(d, today) === "active");
  if (!deals.length) throw new NoVerifiedDataError();
  const amount = req.purchaseAmountVnd ?? null;
  const outcome = compareDeals(deals, { amountVnd: amount, today, merchantId: target.merchant?.id ?? null, merchantName: target.merchant?.name ?? null });
  const cards = await getCardsByIds([...new Set(deals.flatMap((d) => d.cards.map((c) => c.cardId)))].slice(0, MAX_CARDS));
  const index = buildContext({
    today,
    page: { page: "compare", merchant: target.merchant?.name ?? null, category: target.category?.name ?? null },
    purchaseAmountVnd: amount,
    deals: deals.slice(0, MAX_DEALS),
    cards,
    calculations: new Map(outcome.results.map((r) => [r.dealId, r])),
  });
  return summarizeIndex(index, "Tóm tắt các ưu đãi đang áp dụng: khác biệt chính giữa các ưu đãi, điều kiện quan trọng, và giải thích thực tế các khoản tiết kiệm đã được ứng dụng tính (nếu có).");
}

/** Explains a deterministic compatibility result. The AI cannot change the score. */
export async function explainCompatibility(card: CardRecord, deals: DealRecord[], result: CompatibilityResult): Promise<SummaryReply> {
  const today = todayInVietnam();
  const index = buildContext({
    today,
    page: { page: "quiz", card: card.name },
    purchaseAmountVnd: null,
    deals,
    cards: [card],
    extra: {
      compatibility: {
        score: result.score,
        reliability: result.reliability,
        reliability_explanation: result.reliabilityExplanation,
        dimensions: result.dimensions.map((d) => ({ label: d.label, weight_percent: d.weight, status: d.status, score: d.score, explanation: d.explanation, details: d.details })),
        reasons: result.reasons,
        drawbacks: result.drawbacks,
        blocking_conditions: result.blockingConditions,
        carries_balance_warning: result.balanceWarning !== null,
      },
    },
  });
  return summarizeIndex(
    index,
    "Giải thích kết quả mức độ phù hợp đã được ứng dụng tính (extra.compatibility) bằng ngôn ngữ dễ hiểu. Không thay đổi hay tính lại điểm. Nêu lý do phù hợp, hạn chế và điều kiện có thể khiến người dùng không nhận được ưu đãi. Nhắc rằng đây không phải đánh giá tín dụng.",
  );
}
