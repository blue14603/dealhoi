import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handleServiceError, zodDetails } from "@/lib/api";
import { listCards } from "@/lib/services/catalog";

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120);
const Query = z.object({ bank: slug.optional(), category: slug.optional(), q: z.string().max(100).optional() });

export async function GET(req: Request) {
  const params = Object.fromEntries([...new URL(req.url).searchParams].filter(([, v]) => v !== ""));
  const parsed = Query.safeParse(params);
  if (!parsed.success) return apiError("INVALID_INPUT", "Tham số không hợp lệ.", 400, zodDetails(parsed.error));
  try {
    const cards = await listCards({ bankSlug: parsed.data.bank, categorySlug: parsed.data.category, query: parsed.data.q });
    return NextResponse.json({ count: cards.length, cards });
  } catch (e) {
    return handleServiceError(e);
  }
}
