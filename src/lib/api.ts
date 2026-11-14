import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { DatabaseNotConfiguredError } from "@/lib/db/client";
import { AiInvalidResponseError, AiUnavailableError } from "@/lib/ai/openai-client";

export type ApiErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "NO_VERIFIED_DATA"
  | "RATE_LIMITED"
  | "AI_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR";

/** Consistent error envelope: { error: { code, message, details? } } */
export function apiError(code: ApiErrorCode, message: string, status: number, details?: unknown, headers?: HeadersInit) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status, headers });
}

export function zodDetails(err: z.ZodError) {
  return err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

export async function readJson(req: Request, maxBytes = 32_000): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return { ok: false, response: apiError("PAYLOAD_TOO_LARGE", "Yêu cầu quá lớn.", 413) };
  try {
    const text = await req.text();
    if (text.length > maxBytes) return { ok: false, response: apiError("PAYLOAD_TOO_LARGE", "Yêu cầu quá lớn.", 413) };
    return { ok: true, body: text ? JSON.parse(text) : {} };
  } catch {
    return { ok: false, response: apiError("INVALID_INPUT", "Dữ liệu gửi lên không phải JSON hợp lệ.", 400) };
  }
}

export function handleServiceError(e: unknown) {
  if (e instanceof AiUnavailableError || e instanceof AiInvalidResponseError) {
    console.error("[ai]", e.message);
    return apiError("AI_UNAVAILABLE", "DealHoi đang gặp sự cố. Bạn vui lòng thử lại sau.", 503);
  }
  if (e instanceof DatabaseNotConfiguredError) {
    return apiError("SERVICE_UNAVAILABLE", "Cơ sở dữ liệu chưa được cấu hình.", 503);
  }
  console.error("[api]", e);
  return apiError("INTERNAL_ERROR", "Đã có lỗi xảy ra. Bạn vui lòng thử lại sau.", 500);
}
