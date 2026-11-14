import "server-only";
import { compareDeals, type ComparisonOutcome } from "@/lib/domain/savings";
import type { DealRecord } from "@/lib/domain/types";
import { getDealLifecycle, todayInVietnam } from "@/lib/domain/validity";
import { getCategoryBySlug, getMerchantBySlug, listDeals, type CategoryRow, type MerchantRow } from "./catalog";

export interface ComparisonTarget {
  merchant: MerchantRow | null;
  category: CategoryRow | null;
}

export async function resolveTarget(args: { merchantSlug?: string | null; categorySlug?: string | null }): Promise<ComparisonTarget> {
  if (args.merchantSlug) {
    const merchant = await getMerchantBySlug(args.merchantSlug);
    if (merchant) return { merchant, category: (await getCategoryBySlug(merchant.category.slug)) ?? null };
  }
  if (args.categorySlug) {
    return { merchant: null, category: await getCategoryBySlug(args.categorySlug) };
  }
  return { merchant: null, category: null };
}

/** All published deals relevant to the target, including inactive ones (flagged by lifecycle). */
export async function dealsForTarget(target: ComparisonTarget): Promise<DealRecord[]> {
  if (target.merchant) {
    return listDeals({ forMerchant: { id: target.merchant.id, categoryId: target.merchant.category.id } });
  }
  if (target.category) return listDeals({ forCategory: { id: target.category.id } });
  return [];
}

export interface ComparisonData {
  target: ComparisonTarget;
  activeDeals: DealRecord[];
  inactiveDeals: DealRecord[];
  outcome: ComparisonOutcome;
  today: string;
  lastVerifiedAt: string | null;
}

export function runComparison(deals: DealRecord[], amountVnd: number | null, target: ComparisonTarget, today = todayInVietnam()): ComparisonData {
  const activeDeals = deals.filter((d) => getDealLifecycle(d, today) === "active");
  const inactiveDeals = deals.filter((d) => getDealLifecycle(d, today) !== "active");
  const outcome = compareDeals(activeDeals, {
    amountVnd,
    today,
    merchantId: target.merchant?.id ?? null,
    merchantName: target.merchant?.name ?? null,
  });
  const verified = activeDeals.map((d) => d.source?.verifiedAt).filter((v): v is string => !!v).sort();
  return { target, activeDeals, inactiveDeals, outcome, today, lastVerifiedAt: verified.at(-1) ?? null };
}
