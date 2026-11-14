import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handleServiceError, readJson, zodDetails } from "@/lib/api";
import { listDeals } from "@/lib/services/catalog";
import { dealsForTarget, resolveTarget, runComparison } from "@/lib/services/comparison";

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120);
const Body = z
  .object({
    dealIds: z.array(z.uuid()).max(50).optional(),
    merchantSlug: slug.optional(),
    categorySlug: slug.optional(),
    purchaseAmountVnd: z.number().int("Số tiền phải là số nguyên").min(0, "Số tiền không được âm").max(100_000_000_000).nullable().optional(),
  })
  .refine((b) => b.dealIds?.length || b.merchantSlug || b.categorySlug, "Cần dealIds, merchantSlug hoặc categorySlug");

export async function POST(req: Request) {
  const json = await readJson(req);
  if (!json.ok) return json.response;
  const parsed = Body.safeParse(json.body);
  if (!parsed.success) return apiError("INVALID_INPUT", "Dữ liệu không hợp lệ.", 400, zodDetails(parsed.error));
  const b = parsed.data;
  try {
    const target = await resolveTarget({ merchantSlug: b.merchantSlug, categorySlug: b.categorySlug });
    let deals = b.merchantSlug || b.categorySlug ? await dealsForTarget(target) : [];
    if (b.dealIds?.length) {
      deals = b.merchantSlug || b.categorySlug ? deals.filter((d) => b.dealIds!.includes(d.id)) : await listDeals({ ids: b.dealIds });
    }
    const data = runComparison(deals, b.purchaseAmountVnd ?? null, target);
    return NextResponse.json({
      today: data.today,
      purchaseAmountVnd: b.purchaseAmountVnd ?? null,
      results: data.outcome.results,
      bestDealIds: data.outcome.bestDealIds,
      bestSavingsVnd: data.outcome.bestSavingsVnd,
      excluded: data.inactiveDeals.map((d) => ({ dealId: d.id, title: d.title })),
      note: "Ước tính không cộng dồn các ưu đãi. Giá trị điểm thưởng, voucher và trả góp không được quy đổi thành tiền.",
    });
  } catch (e) {
    return handleServiceError(e);
  }
}
