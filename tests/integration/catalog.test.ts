import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Sql } from "@/lib/db/client";
import { databaseAvailable, resetTestDatabase } from "./setup-db";


const available = await databaseAvailable();
const d = available ? describe : describe.skip;
let sql: Sql;
type Catalog = typeof import("@/lib/services/catalog");
let catalog: Catalog;

beforeAll(async () => {
  if (!available) return;
  sql = await resetTestDatabase();
  catalog = await import("@/lib/services/catalog");
}, 60_000);

afterAll(async () => {
  await sql?.end();
});

d("catalogue retrieval (PostgreSQL)", () => {
  it("searches accent- and case-insensitively, including product aliases", async () => {
    const r1 = await catalog.searchCatalog("STARBUCKS");
    expect(r1.merchants[0]?.slug).toBe("starbucks");
    const r2 = await catalog.searchCatalog("phuc long");
    expect(r2.merchants.map((m) => m.slug)).toContain("phuc-long");
    const r3 = await catalog.searchCatalog("iphone");
    expect(r3.merchants.map((m) => m.slug)).toContain("apple");
    expect(r3.categories.map((c) => c.slug)).toContain("dien-tu-cong-nghe");
    const r4 = await catalog.searchCatalog("ve may bay");
    expect(r4.categories.map((c) => c.slug)).toContain("du-lich-hang-khong");
    const empty = await catalog.searchCatalog("   ");
    expect(empty.merchants).toEqual([]);
    const wildcard = await catalog.searchCatalog("%");
    expect(wildcard.merchants).toEqual([]);
  });

  it("retrieves specific, category-wide and general offers for a merchant, never unpublished ones", async () => {
    const m = await catalog.getMerchantBySlug("starbucks");
    const deals = await catalog.listDeals({ forMerchant: { id: m!.id, categoryId: m!.category.id } });
    const titles = deals.map((x) => x.title);
    expect(titles).toContain("Hoàn 20% tại Starbucks");
    expect(titles).toContain("Hoàn 10% chi tiêu cà phê");
    expect(titles).toContain("Hoàn 0,5% mọi chi tiêu");
    expect(titles.some((t) => t.includes("Phúc Long"))).toBe(false); // needs_review draft
    expect(titles.some((t) => t.includes("Highlands"))).toBe(false); // withdrawn
    expect(titles.some((t) => t.includes("chủ thẻ mới"))).toBe(false); // welcome bonus excluded from purchase comparisons
    const active = await catalog.listActiveDeals({ forMerchant: { id: m!.id, categoryId: m!.category.id } });
    expect(active.map((x) => x.title)).not.toContain("Hoàn 30% Starbucks (đã kết thúc)");
  });

  it("lists multiple eligible cards for one promotion", async () => {
    const [deal] = await catalog.listDeals({ query: "Hoàn 20% tại Starbucks" });
    expect(deal.cards.map((c) => c.cardSlug).sort()).toEqual(["sao-mai-cashback-platinum", "sao-mai-online-classic"]);
    expect(deal.cards.find((c) => c.cardSlug === "sao-mai-online-classic")?.additionalEligibilityTerms).toMatch(/chủ thẻ chính/);
  });

  it("hides draft cards and returns card benefits", async () => {
    const cards = await catalog.listCards();
    expect(cards.map((c) => c.slug)).not.toContain("bien-xanh-premium-draft");
    const card = await catalog.getCardBySlug("hoa-sen-travel-signature");
    expect(card?.deals.length).toBeGreaterThanOrEqual(3);
    expect(await catalog.getCardBySlug("bien-xanh-premium-draft")).toBeNull();
  });

  it("filters cards by benefit category", async () => {
    const travel = await catalog.listCards({ categorySlug: "du-lich-hang-khong" });
    expect(travel.map((c) => c.slug)).toContain("hoa-sen-travel-signature");
    expect(travel.map((c) => c.slug)).not.toContain("sao-mai-online-classic");
  });
});

d("data integrity constraints", () => {
  it("enforces RLS for the public role", async () => {
    const rows = await sql.begin(async (tx) => {
      await tx`set local role anon`;
      return tx`select title from deals`;
    });
    expect(rows.map((r) => r.title)).not.toContain("Hoàn 25% Phúc Long (đang chờ xác minh)");
    await expect(
      sql.begin(async (tx) => {
        await tx`set local role anon`;
        await tx`update deals set title = 'x'`;
      }),
    ).rejects.toThrow();
    await expect(
      sql.begin(async (tx) => {
        await tx`set local role anon`;
        return tx`select * from admin_users`;
      }),
    ).rejects.toThrow(/permission denied/);
  });

  it("rejects duplicate deal-to-card mappings", async () => {
    const [dc] = await sql`select deal_id, card_id from deal_cards limit 1`;
    await expect(sql`insert into deal_cards (deal_id, card_id) values (${dc.deal_id as string}, ${dc.card_id as string})`).rejects.toThrow(/duplicate key/);
  });

  it("cannot publish a deal without an eligible card", async () => {
    await expect(
      sql.begin(async (tx) => {
        const [d0] = await tx`select id from deals where publication_status = 'published' limit 1`;
        await tx`delete from deal_cards where deal_id = ${d0.id as string}`;
      }),
    ).rejects.toThrow(/at least one eligible credit card/);
  });

  it("cannot publish without a verified status and source", async () => {
    await expect(sql`update deals set verification_status = 'needs_review' where publication_status = 'published'`).rejects.toThrow(/deals_published_requires_verified/);
    await expect(sql`update deals set source_id = null where publication_status = 'published'`).rejects.toThrow(/deals_published_requires_source/);
  });

  it("rejects invalid money, percentages and date ranges", async () => {
    await expect(sql`update deals set percentage = 101 where import_key = 'demo-sbux-20'`).rejects.toThrow();
    await expect(sql`update deals set maximum_benefit_vnd = -1 where import_key = 'demo-sbux-20'`).rejects.toThrow();
    await expect(sql`update deals set end_date = start_date - 1 where import_key = 'demo-sbux-20'`).rejects.toThrow(/deals_valid_date_range/);
  });

  it("unpublishes dependent deals when a source is un-reviewed", async () => {
    await sql.begin(async (tx) => {
      const [s] = await tx`select id from sources where url like '%sao-mai-promos'`;
      await tx`update sources set verified_at = null where id = ${s.id as string}`;
      const rows = await tx`select publication_status from deals where source_id = ${s.id as string}`;
      expect(rows.every((r) => r.publication_status !== "published")).toBe(true);
      throw new Error("rollback");
    }).catch((e) => {
      if ((e as Error).message !== "rollback") throw e;
    });
  });
});
