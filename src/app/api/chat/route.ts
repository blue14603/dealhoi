import { NextResponse } from "next/server";
import { apiError, handleServiceError, readJson, zodDetails } from "@/lib/api";
import { config } from "@/lib/config";
import { checkRateLimit, clientKey } from "@/lib/ai/rate-limit";
import { ChatRequestSchema, answerChat } from "@/lib/services/ai";

export async function POST(req: Request) {
  const rl = checkRateLimit(`chat:${clientKey(req.headers)}`, config.ai.rateLimitPerMinute);
  if (!rl.allowed) return apiError("RATE_LIMITED", "Bạn gửi quá nhiều câu hỏi. Vui lòng thử lại sau ít phút.", 429, undefined, { "retry-after": String(rl.retryAfterSec) });
  const json = await readJson(req, 24_000);
  if (!json.ok) return json.response;
  const parsed = ChatRequestSchema.safeParse(json.body);
  if (!parsed.success) return apiError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.", 400, zodDetails(parsed.error));
  try {
    return NextResponse.json(await answerChat(parsed.data));
  } catch (e) {
    return handleServiceError(e);
  }
}
