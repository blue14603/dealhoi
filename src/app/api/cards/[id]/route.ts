import { NextResponse } from "next/server";
import { apiError, handleServiceError } from "@/lib/api";
import { selectHighlights } from "@/lib/domain/highlights";
import { getDealLifecycle, todayInVietnam } from "@/lib/domain/validity";
import { getCardBySlug } from "@/lib/services/catalog";

/** `id` is the card slug (stable public identifier). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || id.length > 120) return apiError("INVALID_INPUT", "Mã thẻ không hợp lệ.", 400);
  try {
    const card = await getCardBySlug(id);
    if (!card) return apiError("NOT_FOUND", "Không tìm thấy thẻ đã được xác minh.", 404);
    const today = todayInVietnam();
    const active = card.deals.filter((d) => getDealLifecycle(d, today) === "active");
    return NextResponse.json({
      card: { ...card, deals: undefined },
      benefits: card.deals.map((d) => ({ ...d, lifecycle: getDealLifecycle(d, today) })),
      highlightDealIds: selectHighlights(active).map((d) => d.id),
    });
  } catch (e) {
    return handleServiceError(e);
  }
}
