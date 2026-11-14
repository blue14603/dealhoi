import { NextResponse } from "next/server";
import { apiError, handleServiceError, readJson, zodDetails } from "@/lib/api";
import { config } from "@/lib/config";
import { checkRateLimit, clientKey } from "@/lib/ai/rate-limit";
import { NO_VERIFIED_DATA_MESSAGE, NoVerifiedDataError, SummarizeRequestSchema, summarize } from "@/lib/services/ai";

export async function POST(req: Request) {
  const rl = checkRateLimit(`ai:${clientKey(req.headers)}`, config.ai.rateLimitPerMinute);
  if (!rl.allowed) return apiError("RATE_LIMITED", "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.", 429, undefined, { "retry-after": String(rl.retryAfterSec) });
  const json = await readJson(req, 4_000);
  if (!json.ok) return json.response;
  const parsed = SummarizeRequestSchema.safeParse(json.body);
  if (!parsed.success) return apiError("INVALID_INPUT", "Dữ liệu không hợp lệ.", 400, zodDetails(parsed.error));
  try {
    return NextResponse.json(await summarize(parsed.data));
  } catch (e) {
    if (e instanceof NoVerifiedDataError) return apiError("NO_VERIFIED_DATA", NO_VERIFIED_DATA_MESSAGE, 404);
    return handleServiceError(e);
  }
}
