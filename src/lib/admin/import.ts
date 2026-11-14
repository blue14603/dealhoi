import type { z } from "zod";
import type { TxSql } from "@/lib/db/client";
import { checkDealRules } from "@/lib/domain/deal-rules";
import {
  ENTITY_ORDER,
  ENTITY_SCHEMAS,
  ImportBundleSchema,
  type BankImport,
  type CardImport,
  type CategoryImport,
  type DealImport,
  type EntityKind,
  type MerchantImport,
  type SourceImport,
} from "./import-schema";

/**
 * Import pipeline shared by the CLI seed script and the admin UI.
 *
 * mode "seed"  — trusted operator (CLI). Statuses in the file are applied as-is.
 * mode "admin" — uploaded through the admin UI. New/changed records always land
 *                as drafts / needs_review and must be reviewed and published in
 *                the admin UI. Sources are never marked reviewed by an upload.
 *
 * Duplicate handling: records are matched by natural key (slug, source URL,
 * deal import_key). Identical records are reported "unchanged"; changed ones
 * are updated. Duplicate keys inside one file are rejected. Duplicate card
 * mappings inside one deal are collapsed with a warning.
 */

export type ImportMode = "seed" | "admin";

export interface ImportIssue {
  entity: EntityKind;
  index: number;
  key: string;
  message: string;
}

export interface ImportItem {
  entity: EntityKind;
  key: string;
  action: "create" | "update" | "unchanged";
  notes: string[];
}

export interface ImportReport {
  ok: boolean;
  dryRun: boolean;
  counts: Record<EntityKind, { create: number; update: number; unchanged: number }>;
  items: ImportItem[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

export interface ImportOptions {
  mode: ImportMode;
  dryRun: boolean;
  actorEmail?: string;
}

type Parsed = {
  banks: BankImport[];
  categories: CategoryImport[];
  merchants: MerchantImport[];
  sources: SourceImport[];
  cards: CardImport[];
  deals: DealImport[];
};

const KEY_OF: Record<EntityKind, (r: Record<string, unknown>) => string> = {
  banks: (r) => String(r.slug ?? ""),
  categories: (r) => String(r.slug ?? ""),
  merchants: (r) => String(r.slug ?? ""),
  sources: (r) => String(r.url ?? ""),
  cards: (r) => String(r.slug ?? ""),
  deals: (r) => String(r.import_key ?? ""),
};

class DryRunRollback extends Error {}

function emptyCounts(): ImportReport["counts"] {
  return Object.fromEntries(ENTITY_ORDER.map((k) => [k, { create: 0, update: 0, unchanged: 0 }])) as ImportReport["counts"];
}

function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "(bản ghi)"}: ${i.message}`).join("; ");
}

/** Validates shape and in-file duplicates. Pure: no database access. */
export function validateBundle(input: unknown): { parsed: Parsed; errors: ImportIssue[]; warnings: ImportIssue[] } {
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const parsed: Parsed = { banks: [], categories: [], merchants: [], sources: [], cards: [], deals: [] };
  const bundle = ImportBundleSchema.safeParse(input);
  if (!bundle.success) {
    errors.push({ entity: "deals", index: -1, key: "", message: `Tệp không đúng định dạng: ${formatZodError(bundle.error)}` });
    return { parsed, errors, warnings };
  }
  for (const kind of ENTITY_ORDER) {
    const seen = new Set<string>();
    (bundle.data[kind] as unknown[]).forEach((raw, index) => {
      const key = raw && typeof raw === "object" ? KEY_OF[kind](raw as Record<string, unknown>) : "";
      const res = ENTITY_SCHEMAS[kind].safeParse(raw);
      if (!res.success) {
        errors.push({ entity: kind, index, key, message: formatZodError(res.error) });
        return;
      }
      if (seen.has(key)) {
        errors.push({ entity: kind, index, key, message: "Trùng khóa trong cùng tệp nhập" });
        return;
      }
      seen.add(key);
      if (kind === "deals") {
        const deal = res.data as DealImport;
        const slugs = new Set<string>();
        const unique = deal.cards.filter((c) => {
          if (slugs.has(c.card_slug)) {
            warnings.push({ entity: kind, index, key, message: `Liên kết thẻ trùng lặp "${c.card_slug}" đã được gộp` });
            return false;
          }
          slugs.add(c.card_slug);
          return true;
        });
        deal.cards = unique;
      }
      (parsed[kind] as unknown[]).push(res.data);
    });
  }
  return { parsed, errors, warnings };
}

function changed(existing: Record<string, unknown>, incoming: Record<string, unknown>, fields: string[]): string[] {
  const norm = (v: unknown) => {
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return JSON.stringify(v);
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toISOString();
    return v === undefined ? null : v;
  };
  return fields.filter((f) => norm(existing[f]) !== norm(incoming[f]));
}

export async function runImport(sql: TxSql, input: unknown, opts: ImportOptions): Promise<ImportReport> {
  const { parsed, errors, warnings } = validateBundle(input);
  const report: ImportReport = { ok: false, dryRun: opts.dryRun, counts: emptyCounts(), items: [], errors, warnings };
  if (errors.length) return report;

  const record = (entity: EntityKind, key: string, action: ImportItem["action"], notes: string[] = []) => {
    report.items.push({ entity, key, action, notes });
    report.counts[entity][action] += 1;
  };

  // Savepoint so a dry run (or a failure) leaves the database untouched.
  try {
    await sql.savepoint(async (tx) => {
      const ids = {
        banks: new Map<string, string>(),
        categories: new Map<string, string>(),
        merchants: new Map<string, string>(),
        sources: new Map<string, { id: string; reviewed: boolean }>(),
        cards: new Map<string, string>(),
      };

      // Banks ---------------------------------------------------------------
      for (const b of parsed.banks) {
        const [ex] = await tx`select * from banks where slug = ${b.slug}`;
        const row = { slug: b.slug, name: b.name, website_url: b.website_url, logo_url: b.logo_url, is_demo: b.is_demo };
        if (!ex) {
          const [r] = await tx`insert into banks ${tx(row)} returning id`;
          ids.banks.set(b.slug, r.id as string);
          record("banks", b.slug, "create");
        } else {
          ids.banks.set(b.slug, ex.id as string);
          const diff = changed(ex, row, ["name", "website_url", "logo_url", "is_demo"]);
          if (diff.length) {
            await tx`update banks set ${tx(row, diff as (keyof typeof row)[])} where id = ${ex.id as string}`;
            record("banks", b.slug, "update", [`Thay đổi: ${diff.join(", ")}`]);
          } else record("banks", b.slug, "unchanged");
        }
      }

      // Categories ------------------------------------------------------------
      for (const c of parsed.categories) {
        const [ex] = await tx`select * from categories where slug = ${c.slug}`;
        const row = { ...c };
        if (!ex) {
          const [r] = await tx`insert into categories ${tx(row)} returning id`;
          ids.categories.set(c.slug, r.id as string);
          record("categories", c.slug, "create");
        } else {
          ids.categories.set(c.slug, ex.id as string);
          const diff = changed(ex, row, ["name", "icon", "description", "aliases", "is_browsable", "sort_order"]);
          if (diff.length) {
            await tx`update categories set ${tx(row, diff as (keyof typeof row)[])} where id = ${ex.id as string}`;
            record("categories", c.slug, "update", [`Thay đổi: ${diff.join(", ")}`]);
          } else record("categories", c.slug, "unchanged");
        }
      }

      const categoryId = async (slug: string): Promise<string | null> => {
        if (ids.categories.has(slug)) return ids.categories.get(slug)!;
        const [r] = await tx`select id from categories where slug = ${slug}`;
        if (r) ids.categories.set(slug, r.id as string);
        return (r?.id as string) ?? null;
      };

      // Merchants -------------------------------------------------------------
      for (const [index, m] of parsed.merchants.entries()) {
        const catId = await categoryId(m.category_slug);
        if (!catId) {
          report.errors.push({ entity: "merchants", index, key: m.slug, message: `Không tìm thấy danh mục "${m.category_slug}"` });
          continue;
        }
        const row = { slug: m.slug, name: m.name, category_id: catId, website_url: m.website_url, logo_url: m.logo_url, aliases: m.aliases, is_featured: m.is_featured };
        const [ex] = await tx`select * from merchants where slug = ${m.slug}`;
        if (!ex) {
          const [r] = await tx`insert into merchants ${tx(row)} returning id`;
          ids.merchants.set(m.slug, r.id as string);
          record("merchants", m.slug, "create");
        } else {
          ids.merchants.set(m.slug, ex.id as string);
          const diff = changed(ex, row, ["name", "category_id", "website_url", "logo_url", "aliases", "is_featured"]);
          if (diff.length) {
            await tx`update merchants set ${tx(row, diff as (keyof typeof row)[])} where id = ${ex.id as string}`;
            record("merchants", m.slug, "update", [`Thay đổi: ${diff.join(", ")}`]);
          } else record("merchants", m.slug, "unchanged");
        }
      }

      // Sources ---------------------------------------------------------------
      for (const s of parsed.sources) {
        const [ex] = await tx`select * from sources where url = ${s.url}`;
        const content = {
          url: s.url,
          publisher: s.publisher,
          source_type: s.source_type,
          source_excerpt: s.source_excerpt,
          published_at: s.published_at,
          retrieved_at: s.retrieved_at,
          verification_notes: s.verification_notes,
          is_demo: s.is_demo,
        };
        const notes: string[] = [];
        if (!ex) {
          const verified_at = opts.mode === "seed" ? s.verified_at : null;
          if (opts.mode === "admin" && s.verified_at) notes.push("Nguồn mới cần được duyệt trong trang quản trị (verified_at bị bỏ qua)");
          const [r] = await tx`insert into sources ${tx({ ...content, verified_at })} returning id, verified_at`;
          ids.sources.set(s.url, { id: r.id as string, reviewed: r.verified_at !== null });
          record("sources", s.url, "create", notes);
        } else {
          const diff = changed(ex, content, ["publisher", "source_type", "source_excerpt", "published_at", "retrieved_at", "verification_notes", "is_demo"]);
          let verifiedAt = ex.verified_at as Date | null;
          if (opts.mode === "seed") {
            if (changed(ex, { verified_at: s.verified_at }, ["verified_at"]).length) {
              diff.push("verified_at");
              verifiedAt = s.verified_at ? new Date(s.verified_at) : null;
            }
          } else if (diff.some((f) => f === "source_excerpt" || f === "publisher" || f === "source_type")) {
            verifiedAt = null;
            notes.push("Nội dung nguồn thay đổi: cần duyệt lại; các bản ghi phụ thuộc đã bị gỡ xuất bản");
          }
          if (diff.length) {
            await tx`update sources set ${tx({ ...content, verified_at: verifiedAt })} where id = ${ex.id as string}`;
            record("sources", s.url, "update", [`Thay đổi: ${diff.join(", ")}`, ...notes]);
          } else record("sources", s.url, "unchanged");
          ids.sources.set(s.url, { id: ex.id as string, reviewed: verifiedAt !== null });
        }
      }

      const sourceRef = async (url: string | null) => {
        if (!url) return null;
        if (ids.sources.has(url)) return ids.sources.get(url)!;
        const [r] = await tx`select id, verified_at from sources where url = ${url}`;
        if (!r) return undefined;
        const v = { id: r.id as string, reviewed: r.verified_at !== null };
        ids.sources.set(url, v);
        return v;
      };

      // Cards -----------------------------------------------------------------
      for (const [index, c] of parsed.cards.entries()) {
        let bankId = ids.banks.get(c.bank_slug);
        if (!bankId) {
          const [r] = await tx`select id from banks where slug = ${c.bank_slug}`;
          bankId = r?.id as string | undefined;
        }
        if (!bankId) {
          report.errors.push({ entity: "cards", index, key: c.slug, message: `Không tìm thấy ngân hàng "${c.bank_slug}"` });
          continue;
        }
        const src = await sourceRef(c.source_url);
        if (src === undefined) {
          report.errors.push({ entity: "cards", index, key: c.slug, message: `Không tìm thấy nguồn "${c.source_url}" (khai báo trong mục sources)` });
          continue;
        }
        const content = {
          slug: c.slug,
          bank_id: bankId,
          name: c.name,
          network: c.network,
          card_tier: c.card_tier,
          annual_fee_vnd: c.annual_fee_vnd,
          annual_fee_waiver_terms: c.annual_fee_waiver_terms,
          minimum_income_vnd: c.minimum_income_vnd,
          description: c.description,
          image_url: c.image_url,
          official_url: c.official_url,
          source_id: src?.id ?? null,
          is_active: c.is_active,
          is_featured: c.is_featured,
          is_demo: c.is_demo,
        };
        if (c.verification_status === "verified" && opts.mode === "seed" && !src?.reviewed) {
          report.errors.push({ entity: "cards", index, key: c.slug, message: "Thẻ đã xác minh cần nguồn đã được duyệt" });
          continue;
        }
        const [ex] = await tx`select * from credit_cards where slug = ${c.slug}`;
        if (!ex) {
          const verification_status = opts.mode === "seed" ? c.verification_status : "draft";
          const [r] = await tx`insert into credit_cards ${tx({ ...content, verification_status })} returning id`;
          ids.cards.set(c.slug, r.id as string);
          record("cards", c.slug, "create", opts.mode === "admin" ? ["Thẻ mới ở trạng thái nháp, cần xác minh"] : []);
        } else {
          ids.cards.set(c.slug, ex.id as string);
          const diff = changed(ex, content, Object.keys(content).filter((k) => k !== "slug"));
          let status = ex.verification_status as string;
          const notes: string[] = [];
          if (opts.mode === "seed") {
            if (status !== c.verification_status) diff.push("verification_status");
            status = c.verification_status;
          } else if (diff.some((f) => !["is_featured", "image_url", "description"].includes(f)) && status === "verified") {
            status = "needs_review";
            notes.push("Thông tin tài chính thay đổi: chuyển sang cần xác minh lại");
          }
          if (diff.length) {
            await tx`update credit_cards set ${tx({ ...content, verification_status: status })} where id = ${ex.id as string}`;
            record("cards", c.slug, "update", [`Thay đổi: ${diff.join(", ")}`, ...notes]);
          } else record("cards", c.slug, "unchanged");
        }
      }

      const cardId = async (slug: string) => {
        if (ids.cards.has(slug)) return ids.cards.get(slug)!;
        const [r] = await tx`select id from credit_cards where slug = ${slug}`;
        if (r) ids.cards.set(slug, r.id as string);
        return (r?.id as string) ?? null;
      };
      const merchantId = async (slug: string | null) => {
        if (!slug) return null;
        if (ids.merchants.has(slug)) return ids.merchants.get(slug)!;
        const [r] = await tx`select id from merchants where slug = ${slug}`;
        if (r) ids.merchants.set(slug, r.id as string);
        return r ? (r.id as string) : undefined;
      };

      // Deals -----------------------------------------------------------------
      for (const [index, d] of parsed.deals.entries()) {
        const issue = (message: string) => report.errors.push({ entity: "deals", index, key: d.import_key, message });
        const catId = await categoryId(d.category_slug);
        if (!catId) {
          issue(`Không tìm thấy danh mục "${d.category_slug}"`);
          continue;
        }
        const mId = await merchantId(d.merchant_slug);
        if (mId === undefined) {
          issue(`Không tìm thấy cửa hàng "${d.merchant_slug}"`);
          continue;
        }
        const src = await sourceRef(d.source_url);
        if (src === undefined) {
          issue(`Không tìm thấy nguồn "${d.source_url}" (khai báo trong mục sources)`);
          continue;
        }
        const cardRows: { card_id: string; additional_eligibility_terms: string | null }[] = [];
        let missingCard = false;
        for (const c of d.cards) {
          const id = await cardId(c.card_slug);
          if (!id) {
            issue(`Không tìm thấy thẻ "${c.card_slug}"`);
            missingCard = true;
          } else cardRows.push({ card_id: id, additional_eligibility_terms: c.additional_eligibility_terms });
        }
        if (missingCard) continue;

        const [ex] = await tx`select * from deals where import_key = ${d.import_key}`;
        const content = {
          import_key: d.import_key,
          title: d.title,
          description: d.description,
          merchant_id: mId,
          category_id: catId,
          benefit_type: d.benefit_type,
          offer_type: d.offer_type,
          percentage: d.percentage,
          fixed_amount_vnd: d.fixed_amount_vnd,
          maximum_benefit_vnd: d.maximum_benefit_vnd,
          cap_period: d.cap_period,
          cap_is_unlimited: d.cap_is_unlimited,
          minimum_spend_vnd: d.minimum_spend_vnd,
          minimum_spend_period: d.minimum_spend_period,
          installment_months: d.installment_months,
          installment_fee_vnd: d.installment_fee_vnd,
          eligibility_terms: d.eligibility_terms,
          terms_and_conditions: d.terms_and_conditions,
          payment_channel: d.payment_channel,
          merchant_scope: d.merchant_scope,
          start_date: d.start_date,
          end_date: d.end_date,
          source_id: src?.id ?? null,
          is_featured: d.is_featured,
          is_demo: d.is_demo,
        };

        let existingCards: { card_id: string; additional_eligibility_terms: string | null }[] = [];
        if (ex) existingCards = (await tx`select card_id, additional_eligibility_terms from deal_cards where deal_id = ${ex.id as string} order by card_id`) as unknown as typeof existingCards;
        const cardsChanged =
          JSON.stringify([...cardRows].sort((a, b) => a.card_id.localeCompare(b.card_id))) !==
          JSON.stringify(existingCards.map((r) => ({ card_id: r.card_id, additional_eligibility_terms: r.additional_eligibility_terms })));
        const diff = ex ? changed(ex, content, Object.keys(content).filter((k) => k !== "import_key")) : [];
        if (cardsChanged && ex) diff.push("cards");
        const financialChange = diff.some((f) => f !== "is_featured");

        let verification = d.verification_status as string;
        let publication = d.publication_status as string;
        const notes: string[] = [];
        if (opts.mode === "admin") {
          if (!ex) {
            verification = "draft";
            publication = "draft";
            notes.push("Ưu đãi mới ở trạng thái nháp, cần xác minh và xuất bản trong trang quản trị");
          } else {
            verification = ex.verification_status as string;
            publication = ex.publication_status as string;
            if (financialChange && publication === "published") {
              verification = "needs_review";
              publication = "draft";
              notes.push("Điều kiện ưu đãi thay đổi: đã gỡ xuất bản, cần xác minh lại");
            } else if (financialChange && verification === "verified") {
              verification = "needs_review";
            }
          }
        } else if (ex && (verification !== ex.verification_status || publication !== ex.publication_status)) {
          diff.push("status");
        }

        const rules = checkDealRules({
          benefitType: d.benefit_type,
          offerType: d.offer_type,
          merchantScope: d.merchant_scope,
          hasMerchant: mId !== null,
          percentage: d.percentage,
          fixedAmountVnd: d.fixed_amount_vnd,
          maximumBenefitVnd: d.maximum_benefit_vnd,
          capPeriod: d.cap_period,
          capIsUnlimited: d.cap_is_unlimited,
          minimumSpendVnd: d.minimum_spend_vnd,
          installmentMonths: d.installment_months,
          installmentFeeVnd: d.installment_fee_vnd,
          paymentChannel: d.payment_channel,
          startDate: d.start_date,
          endDate: d.end_date,
          verificationStatus: verification as DealImport["verification_status"],
          publicationStatus: publication as DealImport["publication_status"],
          hasSource: src !== null,
          sourceReviewed: !!src?.reviewed,
          cardCount: cardRows.length,
        });
        if (rules.errors.length || rules.publishBlockers.length) {
          issue([...rules.errors, ...rules.publishBlockers].join("; "));
          continue;
        }
        for (const w of rules.warnings) report.warnings.push({ entity: "deals", index, key: d.import_key, message: w });

        const row = { ...content, verification_status: verification, publication_status: publication };
        let dealId: string;
        if (!ex) {
          const [r] = await tx`insert into deals ${tx(row)} returning id`;
          dealId = r.id as string;
          record("deals", d.import_key, "create", notes);
        } else {
          dealId = ex.id as string;
          if (diff.length) {
            await tx`update deals set ${tx(row)} where id = ${dealId}`;
            record("deals", d.import_key, "update", [`Thay đổi: ${diff.join(", ")}`, ...notes]);
          } else record("deals", d.import_key, "unchanged");
        }
        if (!ex || cardsChanged) {
          await tx`delete from deal_cards where deal_id = ${dealId}`;
          for (const c of cardRows) {
            await tx`insert into deal_cards ${tx({ deal_id: dealId, ...c })}`;
          }
        }
      }

      if (report.errors.length) throw new DryRunRollback();
      // Run deferred publication constraints now so failures surface in the report.
      await tx`set constraints all immediate`;
      await tx`set constraints all deferred`;
      if (opts.actorEmail && !opts.dryRun) {
        await tx`insert into admin_audit_log ${tx({
          actor_email: opts.actorEmail,
          action: "import",
          entity_type: "bundle",
          entity_id: null,
          details: tx.json(JSON.parse(JSON.stringify(report.counts))),
        })}`;
      }
      if (opts.dryRun) throw new DryRunRollback();
    });
  } catch (e) {
    if (!(e instanceof DryRunRollback)) {
      const message = e instanceof Error ? e.message : String(e);
      report.errors.push({ entity: "deals", index: -1, key: "", message: `Lỗi cơ sở dữ liệu: ${message}` });
    }
  }
  report.ok = report.errors.length === 0;
  return report;
}
