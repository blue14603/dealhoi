import "server-only";
import { DISCOVERY_CONCEPTS, type DiscoveryConcept } from "@/config/discovery";
import { rankForHighlight } from "@/lib/domain/highlights";
import type { DealRecord } from "@/lib/domain/types";
import { getDealLifecycle, todayInVietnam } from "@/lib/domain/validity";
import { getCategoryBySlug, getMerchantBySlug, listActiveDeals, listDeals } from "./catalog";

export interface DiscoveryHighlight {
  concept: DiscoveryConcept;
  href: string;
  /** The headline offer, chosen by a fixed rule. null = no verified active offer. */
  deal: DealRecord | null;
  activeOfferCount: number;
}

/**
 * Picks the offer shown on an editorial card:
 *  1. offers specific to the merchant before category-wide or general ones;
 *  2. cashback/discount with a known value before other benefit types;
 *  3. then the standard highlight rule (featured, ongoing, larger cap, larger %).
 * General "all spending" offers are never used as a card headline.
 */
export function pickHeadlineDeal(deals: DealRecord[]): DealRecord | null {
  const candidates = deals.filter((d) => d.merchantScope !== "general" && d.offerType !== "welcome");
  const monetary = (d: DealRecord) => (d.benefitType === "cashback" || d.benefitType === "discount") && (d.percentage !== null || d.fixedAmountVnd !== null);
  return (
    [...candidates].sort((a, b) => {
      const s = Number(b.merchantScope === "specific_merchant") - Number(a.merchantScope === "specific_merchant");
      if (s) return s;
      const m = Number(monetary(b)) - Number(monetary(a));
      if (m) return m;
      return rankForHighlight(a, b);
    })[0] ?? null
  );
}

export async function getDiscoveryHighlights(): Promise<DiscoveryHighlight[]> {
  return Promise.all(
    DISCOVERY_CONCEPTS.map(async (concept) => {
      if ("merchantSlug" in concept.target) {
        const href = `/so-sanh?merchant=${concept.target.merchantSlug}`;
        const merchant = await getMerchantBySlug(concept.target.merchantSlug);
        if (!merchant) return { concept, href, deal: null, activeOfferCount: 0 };
        const deals = await listActiveDeals({ forMerchant: { id: merchant.id, categoryId: merchant.category.id } });
        return { concept, href, deal: pickHeadlineDeal(deals), activeOfferCount: deals.length };
      }
      const href = `/so-sanh?category=${concept.target.categorySlug}`;
      const category = await getCategoryBySlug(concept.target.categorySlug);
      if (!category) return { concept, href, deal: null, activeOfferCount: 0 };
      const deals = await listActiveDeals({ forCategory: { id: category.id } });
      return { concept, href, deal: pickHeadlineDeal(deals), activeOfferCount: deals.length };
    }),
  );
}

/** Main verified benefit for a credit card preview (same rule, card-scoped). */
export async function getCardHeadlineDeals(cardIds: string[]): Promise<Map<string, { deal: DealRecord | null; categories: string[] }>> {
  const out = new Map<string, { deal: DealRecord | null; categories: string[] }>();
  await Promise.all(
    cardIds.map(async (id) => {
      const deals = (await listDeals({ cardId: id })).filter((d) => d.offerType !== "welcome");
      const today = todayInVietnam();
      const active = deals.filter((d) => getDealLifecycle(d, today) === "active");
      const categories = [...new Set(active.filter((d) => d.merchantScope !== "general").map((d) => d.category.name))];
      const known = (d: DealRecord) => (d.percentage !== null || d.fixedAmountVnd !== null || d.installmentMonths !== null ? 1 : 0);
      const best = [...active].sort((a, b) => known(b) - known(a) || rankForHighlight(a, b))[0] ?? null;
      out.set(id, { deal: best, categories });
    }),
  );
  return out;
}
