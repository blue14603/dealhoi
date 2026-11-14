/**
 * LIVE OpenAI test. Skipped unless OPENAI_API_KEY_LIVE is set, e.g.
 *   OPENAI_API_KEY_LIVE=sk-... OPENAI_MODEL=gpt-4.1-mini npx vitest run tests/integration/live-ai.test.ts
 * It sends ONE request with fictional fixture data to the real API and checks the
 * response passes the same schema, identifier and numeric-grounding validation as production.
 */
import { describe, expect, it } from "vitest";
import { groundedCall } from "@/lib/ai/grounded-call";
import { buildContext } from "@/lib/ai/grounding";
import { createStructuredCaller } from "@/lib/ai/openai-client";
import { CHAT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { CHAT_JSON_SCHEMA, ChatResponseSchema } from "@/lib/ai/schemas";
import { compareDeals } from "@/lib/domain/savings";
import { TODAY, makeCard, makeDeal } from "../fixtures/builders";

const key = process.env.OPENAI_API_KEY_LIVE;

describe.skipIf(!key)("live OpenAI request", () => {
  it("returns a grounded, valid answer", async () => {
    const deal = makeDeal({ id: "live-deal", title: "Hoàn 20% tại Cafe A", percentage: 20, maximumBenefitVnd: 50_000 });
    const outcome = compareDeals([deal], { amountVnd: 150_000, today: TODAY });
    const index = buildContext({ today: TODAY, page: { page: "compare", merchant: "Cafe A" }, purchaseAmountVnd: 150_000, deals: [deal], cards: [makeCard()], calculations: new Map(outcome.results.map((r) => [r.dealId, r])) });
    const caller = createStructuredCaller({ apiKey: key, model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini", baseUrl: "https://api.openai.com/v1", timeoutMs: 30_000, maxOutputTokens: 900 });
    const { value } = await groundedCall({
      caller,
      systemPrompt: CHAT_SYSTEM_PROMPT,
      index,
      conversation: [{ role: "user", content: "Tôi mua 150.000 ₫ thì được hoàn bao nhiêu?" }],
      schemaName: "dealhoi_chat_response",
      jsonSchema: CHAT_JSON_SCHEMA,
      schema: ChatResponseSchema,
      textFields: (v) => [v.answer, ...v.uncertainties],
      userTexts: ["Tôi mua 150.000 ₫ thì được hoàn bao nhiêu?"],
    });
    expect(value.answer.length).toBeGreaterThan(0);
    expect(value.source_ids.every((id) => index.sourceIds.has(id))).toBe(true);
  }, 90_000);
});
