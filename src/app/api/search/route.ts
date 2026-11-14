import { NextResponse } from "next/server";
import { apiError, handleServiceError } from "@/lib/api";
import { searchCatalog } from "@/lib/services/catalog";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.length > 100) return apiError("INVALID_INPUT", "Từ khóa tối đa 100 ký tự.", 400);
  try {
    const r = await searchCatalog(q);
    return NextResponse.json({
      query: r.query,
      merchants: r.merchants.map((m) => ({ slug: m.slug, name: m.name, category: m.category.name })),
      categories: r.categories.map((c) => ({ slug: c.slug, name: c.name })),
      cards: r.cards.map((c) => ({ slug: c.slug, name: c.name, bank: c.bank.name, isDemo: c.isDemo })),
    });
  } catch (e) {
    return handleServiceError(e);
  }
}
