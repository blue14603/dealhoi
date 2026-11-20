import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Sql } from "@/lib/db/client";
import { databaseAvailable, resetTestDatabase } from "./setup-db";

const available = await databaseAvailable();
const d = available ? describe : describe.skip;
let sql: Sql;
type AdminData = typeof import("@/lib/admin/admin-data");
let admin: AdminData;

beforeAll(async () => {
  if (!available) return;
  sql = await resetTestDatabase();
  admin = await import("@/lib/admin/admin-data");
}, 60_000);

afterAll(async () => {
  await sql?.end();
});

/** The edit form's values for a deal, as the browser would submit them. */
function formValues(deal: Record<string, unknown>) {
  const s = (v: unknown) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
  return {
    title: s(deal.title),
    description: s(deal.description),
    percentage: s(deal.percentage),
    fixed_amount_vnd: s(deal.fixed_amount_vnd),
    maximum_benefit_vnd: s(deal.maximum_benefit_vnd),
    cap_period: s(deal.cap_period),
    cap_is_unlimited: s(deal.cap_is_unlimited),
    minimum_spend_vnd: s(deal.minimum_spend_vnd),
    minimum_spend_period: s(deal.minimum_spend_period),
    installment_months: s(deal.installment_months),
    installment_fee_vnd: s(deal.installment_fee_vnd),
    eligibility_terms: s(deal.eligibility_terms),
    terms_and_conditions: s(deal.terms_and_conditions),
    payment_channel: s(deal.payment_channel),
    start_date: s(deal.start_date),
    end_date: s(deal.end_date),
    verification_status: s(deal.verification_status),
    publication_status: s(deal.publication_status),
    is_featured: deal.is_featured ? "on" : "",
  };
}

d("admin: choosing the eligible cards of a deal (PostgreSQL)", () => {
  it("adds and removes cards, keeps extra terms of kept cards, and refuses none on a published deal", async () => {
    const [row] = await sql`
      select d.id from deals d
      where d.publication_status = 'published' and (select count(*) from deal_cards dc where dc.deal_id = d.id) >= 2
      limit 1`;
    expect(row).toBeTruthy();
    const id = String(row.id);
    const before = (await admin.getAdminDeal(id))!;
    const [keep, drop] = before.cards.map((c) => String(c.card_id));
    await sql`update deal_cards set additional_eligibility_terms = 'Chỉ thẻ chính' where deal_id = ${id} and card_id = ${keep}`;
    const options = await admin.listCardOptions();
    const extra = options.find((o) => !before.cards.some((c) => String(c.card_id) === o.id))!;

    const input = admin.DealEditSchema.parse({ ...formValues(before.deal), card_ids: [keep, extra.id] });
    const saved = await admin.updateDeal(id, input, "test@example.com");
    expect(saved.ok).toBe(true);
    const after = await sql`select card_id, additional_eligibility_terms from deal_cards where deal_id = ${id} order by card_id`;
    expect(after.map((r) => String(r.card_id)).sort()).toEqual([keep, extra.id].sort());
    expect(after.find((r) => String(r.card_id) === keep)?.additional_eligibility_terms).toBe("Chỉ thẻ chính");
    expect(after.some((r) => String(r.card_id) === drop)).toBe(false);

    const none = admin.DealEditSchema.parse({ ...formValues(before.deal), card_ids: [] });
    const refused = await admin.updateDeal(id, none, "test@example.com");
    expect(refused.ok).toBe(false);
    const unchanged = await sql`select count(*)::int as n from deal_cards where deal_id = ${id}`;
    expect(unchanged[0].n).toBe(2);
  });

  it("leaves the cards untouched when the form has no card field", async () => {
    const [row] = await sql`select id from deals where publication_status = 'published' limit 1`;
    const id = String(row.id);
    const before = (await admin.getAdminDeal(id))!;
    const input = admin.DealEditSchema.parse(formValues(before.deal));
    expect(input.card_ids).toBeUndefined();
    expect((await admin.updateDeal(id, input, "test@example.com")).ok).toBe(true);
    const after = (await admin.getAdminDeal(id))!;
    expect(after.cards.map((c) => c.card_id)).toEqual(before.cards.map((c) => c.card_id));
  });
});
