import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handleServiceError, zodDetails } from "@/lib/api";
import { compareDeals } from "@/lib/domain/savings";
import { BENEFIT_TYPES, PAYMENT_CHANNELS } from "@/lib/domain/types";
import { getDealLifecycle, todayInVietnam } from "@/lib/domain/validity";
import { listDeals } from "@/lib/services/catalog";
import { resolveTarget } from "@/lib/services/comparison";

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120);
const Query = z.object({
  q: z.string().max(100).optional(),
  merchant: slug.optional(),
  category: slug.optional(),
  bank: slug.optional(),
  type: z.enum(BENEFIT_TYPES).optional(),
  channel: z.enum(PAYMENT_CHANNELS).optional(),
  include: z.enum(["active", "all"]).default("active"),
  amount: z.coerce.number().int().min(0).max(100_000_000_000).optional(),
});

export async function GET(req: Request) {
  const params = Object.fromEntries([...new URL(req.url).searchParams].filter(([, v]) => v !== ""));
  const parsed = Query.safeParse(params);
  if (!parsed.success) return apiError("INVALID_INPUT", "Tham số không hợp lệ.", 400, zodDetails(parsed.error));
  const p = parsed.data;
  try {
    const target = await resolveTarget({ merchantSlug: p.merchant, categorySlug: p.category });
    if ((p.merchant && !target.merchant) || (p.category && !p.merchant && !target.category)) {
      return apiError("NOT_FOUND", "Không tìm thấy cửa hàng hoặc danh mục.", 404);
    }
    const today = todayInVietnam();
    let deals = await listDeals({
      query: p.q,
      bankSlug: p.bank,
      benefitType: p.type,
      channel: p.channel,
      forMerchant: target.merchant ? { id: target.merchant.id, categoryId: target.merchant.category.id } : undefined,
      forCategory: !target.merchant && target.category ? { id: target.category.id } : undefined,
    });
    if (p.include === "active") deals = deals.filter((d) => getDealLifecycle(d, today) === "active");
    const outcome = compareDeals(deals, { amountVnd: p.amount ?? null, today, merchantId: target.merchant?.id, merchantName: target.merchant?.name });
    return NextResponse.json({
      today,
      count: deals.length,
      deals: deals.map((d) => ({ ...d, lifecycle: getDealLifecycle(d, today) })),
      calculations: outcome.results,
      bestDealIds: outcome.bestDealIds,
    });
  } catch (e) {
    return handleServiceError(e);
  }
}
