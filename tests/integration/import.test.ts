import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { csvToRecords, parseCsv } from "@/lib/admin/csv";
import { runImport, validateBundle } from "@/lib/admin/import";
import type { Sql } from "@/lib/db/client";
import { databaseAvailable, resetTestDatabase } from "./setup-db";

const available = await databaseAvailable();
const d = available ? describe : describe.skip;
let sql: Sql;

beforeAll(async () => {
  if (available) sql = await resetTestDatabase();
}, 60_000);
afterAll(async () => {
  await sql?.end();
});

const baseDeal = {
  import_key: "test-deal-1",
  title: "Test deal",
  description: "Test",
  merchant_slug: "shopee",
  category_slug: "mua-sam-truc-tuyen",
  benefit_type: "cashback",
  offer_type: "temporary",
  percentage: 5,
  maximum_benefit_vnd: 50000,
  cap_period: "transaction",
  minimum_spend_vnd: 0,
  merchant_scope: "specific_merchant",
  start_date: "2026-01-01",
  end_date: "2026-12-31",
  source_url: "https://example.com/dealhoi-demo/sao-mai-promos",
  verification_status: "verified",
  publication_status: "published",
  cards: [{ card_slug: "sao-mai-online-classic" }],
};

describe("import validation (no database)", () => {
  it("parses quoted CSV with commas and newlines", () => {
    expect(parseCsv('a,b\n"x, y","line1\nline2"\n')).toEqual([["a", "b"], ["x, y", "line1\nline2"]]);
  });
  it("converts CSV templates to records", () => {
    const recs = csvToRecords(readFileSync("data/templates/deals.csv", "utf8"));
    expect(recs.length).toBeGreaterThan(0);
    expect(Array.isArray(recs[0].cards)).toBe(true);
  });
  it("collapses duplicate card mappings inside a deal with a warning", () => {
    const r = validateBundle({ deals: [{ ...baseDeal, cards: [{ card_slug: "a" }, { card_slug: "a" }] }] });
    expect(r.errors).toEqual([]);
    expect(r.parsed.deals[0].cards).toHaveLength(1);
    expect(r.warnings[0].message).toMatch(/trùng lặp/);
  });
  it("rejects duplicate keys in one file", () => {
    const r = validateBundle({ deals: [baseDeal, baseDeal] });
    expect(r.errors[0].message).toMatch(/Trùng khóa/);
  });
  it("rejects invalid values and URLs", () => {
    const r = validateBundle({ deals: [{ ...baseDeal, percentage: 120, source_url: "javascript:alert(1)", maximum_benefit_vnd: -5 }] });
    expect(r.errors[0].message).toMatch(/percentage/);
    expect(r.errors[0].message).toMatch(/source_url/);
    expect(r.errors[0].message).toMatch(/maximum_benefit_vnd/);
  });
});

d("import against PostgreSQL", () => {
  it("dry run reports actions without writing", async () => {
    const report = await sql.begin((tx) => runImport(tx, { deals: [baseDeal] }, { mode: "admin", dryRun: true }));
    expect(report.ok).toBe(true);
    expect(report.counts.deals.create).toBe(1);
    const rows = await sql`select 1 from deals where import_key = 'test-deal-1'`;
    expect(rows.length).toBe(0);
  });

  it("admin imports land as drafts; duplicates are detected as unchanged", async () => {
    const first = await sql.begin((tx) => runImport(tx, { deals: [baseDeal] }, { mode: "admin", dryRun: false, actorEmail: "t@example.com" }));
    expect(first.ok).toBe(true);
    const [row] = await sql`select verification_status, publication_status from deals where import_key = 'test-deal-1'`;
    expect(row).toMatchObject({ verification_status: "draft", publication_status: "draft" });
    const again = await sql.begin((tx) => runImport(tx, { deals: [baseDeal] }, { mode: "admin", dryRun: false }));
    expect(again.counts.deals).toEqual({ create: 0, update: 0, unchanged: 1 });
    const [{ count }] = await sql`select count(*)::int as count from deals where import_key = 'test-deal-1'`;
    expect(count).toBe(1);
  });

  it("re-importing changed terms of a published deal unpublishes it for review", async () => {
    await sql`update deals set verification_status = 'verified', publication_status = 'published' where import_key = 'test-deal-1'`;
    const r = await sql.begin((tx) => runImport(tx, { deals: [{ ...baseDeal, percentage: 7 }] }, { mode: "admin", dryRun: false }));
    expect(r.counts.deals.update).toBe(1);
    const [row] = await sql`select verification_status, publication_status, percentage from deals where import_key = 'test-deal-1'`;
    expect(row).toMatchObject({ verification_status: "needs_review", publication_status: "draft", percentage: 7 });
  });

  it("reports unknown references and refuses publishing without cards (seed mode)", async () => {
    const r = await sql.begin((tx) => runImport(tx, { deals: [{ ...baseDeal, import_key: "x2", cards: [{ card_slug: "nope" }] }] }, { mode: "seed", dryRun: false }));
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toMatch(/Không tìm thấy thẻ/);
    const r2 = await sql.begin((tx) => runImport(tx, { deals: [{ ...baseDeal, import_key: "x3", cards: [] }] }, { mode: "seed", dryRun: false }));
    expect(r2.ok).toBe(false);
    expect(r2.errors[0].message).toMatch(/ít nhất một thẻ/);
  });
});

d("card_details import against PostgreSQL", () => {
  const url = "https://example.com/the/card-details-test";
  const source = { url, publisher: "Test Bank", source_type: "official_bank", source_excerpt: "Phí thường niên 699,000 VND", retrieved_at: "2026-11-20T00:00:00.000Z" };
  const setup = async () => {
    const [bank] = await sql`select slug from banks limit 1`;
    await sql.begin((tx) =>
      runImport(tx, { cards: [{ slug: "card-details-test", bank_slug: bank.slug, name: "Thẻ thử", annual_fee_vnd: 500000 }] }, { mode: "admin", dryRun: false }),
    );
  };

  it("fills only empty fields, keeps entered values, and links the card page as source", async () => {
    await setup();
    const r = await sql.begin((tx) =>
      runImport(
        tx,
        { sources: [source], card_details: [{ slug: "card-details-test", source_url: url, network: "Visa", annual_fee_vnd: 699000, minimum_income_vnd: 10000000 }] },
        { mode: "admin", dryRun: false },
      ),
    );
    expect(r.ok).toBe(true);
    const item = r.items.find((i) => i.entity === "card_details")!;
    expect(item.action).toBe("update");
    expect(item.notes.join(" ")).toMatch(/annual_fee_vnd = 699000/);
    const [card] = await sql`select c.network, c.annual_fee_vnd, c.minimum_income_vnd, s.url from credit_cards c left join sources s on s.id = c.source_id where c.slug = 'card-details-test'`;
    expect(card).toMatchObject({ network: "Visa", url });
    expect(Number(card.annual_fee_vnd)).toBe(500000);
    expect(Number(card.minimum_income_vnd)).toBe(10000000);

    const again = await sql.begin((tx) =>
      runImport(tx, { sources: [source], card_details: [{ slug: "card-details-test", source_url: url, network: "Visa" }] }, { mode: "admin", dryRun: false }),
    );
    expect(again.items.find((i) => i.entity === "card_details")?.action).toBe("unchanged");
  });

  it("reports unknown cards", async () => {
    const r = await sql.begin((tx) => runImport(tx, { card_details: [{ slug: "no-such-card", network: "Visa" }] }, { mode: "admin", dryRun: true }));
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toMatch(/stubs\.json/);
  });
});
