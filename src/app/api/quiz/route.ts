import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handleServiceError, readJson, zodDetails } from "@/lib/api";
import { config } from "@/lib/config";
import { resolveScoringWeights } from "@/config/scoring";
import { checkRateLimit, clientKey } from "@/lib/ai/rate-limit";
import { scoreCompatibility } from "@/lib/domain/compatibility";
import { QuizAnswersSchema } from "@/lib/domain/quiz";
import { todayInVietnam } from "@/lib/domain/validity";
import { getCardBySlug, listCategories } from "@/lib/services/catalog";
import { AI_UNAVAILABLE_MESSAGE, explainCompatibility } from "@/lib/services/ai";
import { AiInvalidResponseError, AiUnavailableError } from "@/lib/ai/openai-client";

const Body = z.object({
  cardSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120),
  answers: QuizAnswersSchema,
  explain: z.boolean().default(false),
});

export async function POST(req: Request) {
  const json = await readJson(req, 8_000);
  if (!json.ok) return json.response;
  const parsed = Body.safeParse(json.body);
  if (!parsed.success) return apiError("INVALID_INPUT", "Câu trả lời không hợp lệ.", 400, zodDetails(parsed.error));
  const { cardSlug, answers, explain } = parsed.data;
  try {
    const card = await getCardBySlug(cardSlug);
    if (!card) return apiError("NOT_FOUND", "Không tìm thấy thẻ đã được xác minh.", 404);
    const categories = await listCategories();
    const result = scoreCompatibility({
      card,
      deals: card.deals,
      answers,
      weights: resolveScoringWeights(config.scoringWeightsJson),
      today: todayInVietnam(),
      categoryNames: Object.fromEntries(categories.map((c) => [c.slug, c.name])),
    });
    let explanation = null;
    let explanationError: string | null = null;
    if (explain) {
      const rl = checkRateLimit(`ai:${clientKey(req.headers)}`, config.ai.rateLimitPerMinute);
      if (!rl.allowed) explanationError = "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.";
      else {
        try {
          explanation = await explainCompatibility(card, card.deals, result);
        } catch (e) {
          if (e instanceof AiUnavailableError || e instanceof AiInvalidResponseError) explanationError = AI_UNAVAILABLE_MESSAGE;
          else throw e;
        }
      }
    }
    return NextResponse.json({ result, explanation, explanationError });
  } catch (e) {
    return handleServiceError(e);
  }
}
