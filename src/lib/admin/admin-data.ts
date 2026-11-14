import "server-only";
import { z } from "zod";
import { config } from "@/lib/config";
import { getSql, withAdminTx } from "@/lib/db/client";
import { checkDealRules } from "@/lib/domain/deal-rules";
import { CAP_PERIODS, PAYMENT_CHANNELS, PUBLICATION_STATUSES, VERIFICATION_STATUSES } from "@/lib/domain/types";
import { getDealLifecycle, isVerificationStale, todayInVietnam } from "@/lib/domain/validity";

/**
 * Administrative data access. Uses the privileged server connection, so every
 * exported function must only be called after requireAdmin() succeeds.
 */

export interface AdminDealRow {
  id: string;
  import_key: string | null;
  title: string;
  benefit_type: string;
  offer_type: string;
  verification_status: string;
  publication_status: string;
  is_featured: boolean;
  is_demo: boolean;
  start_date: string | null;
  end_date: string | null;
  merchant_name: string | null;
  category_name: string;
  source_url: string | null;
  source_verified_at: string | null;
  card_names: string[];
  updated_at: string;
}

export async function listAdminDeals(filter: { status?: string } = {}): Promise<(AdminDealRow & { lifecycle: string; stale: boolean })[]> {
  const rows = (await getSql()`
    select d.id, d.import_key, d.title, d.benefit_type, d.offer_type, d.verification_status, d.publication_status,
      d.is_featured, d.is_demo, d.start_date, d.end_date, d.updated_at, d.merchant_scope,
      m.name as merchant_name, c.name as category_name, s.url as source_url, s.verified_at as source_verified_at,
      coalesce((select array_agg(cc.name order by cc.name) from deal_cards dc join credit_cards cc on cc.id = dc.card_id where dc.deal_id = d.id), '{}') as card_names
    from deals d join categories c on c.id = d.category_id
    left join merchants m on m.id = d.merchant_id left join sources s on s.id = d.source_id
    where (${filter.status ?? null}::text is null or d.verification_status::text = ${filter.status ?? null}::text or d.publication_status::text = ${filter.status ?? null}::text)
    order by d.updated_at desc limit 500`) as unknown as AdminDealRow[];
  const today = todayInVietnam();
  const now = new Date();
  return rows.map((r) => ({
    ...r,
    lifecycle: getDealLifecycle(
      {
        offerType: r.offer_type as never,
        startDate: r.start_date,
        endDate: r.end_date,
        verificationStatus: r.verification_status as never,
        publicationStatus: r.publication_status as never,
      },
      today,
    ),
    stale: r.publication_status === "published" && isVerificationStale(r.source_verified_at ? new Date(r.source_verified_at).toISOString() : null, now, config.staleAfterDays),
  }));
}

export async function getAdminDeal(id: string) {
  const sql = getSql();
  const [deal] = await sql`
    select d.*, s.url as source_url, s.verified_at as source_verified_at, m.slug as merchant_slug, c.slug as category_slug
    from deals d left join sources s on s.id = d.source_id left join merchants m on m.id = d.merchant_id join categories c on c.id = d.category_id
    where d.id = ${id}`;
  if (!deal) return null;
  const cards = await sql`select dc.card_id, dc.additional_eligibility_terms, cc.name, cc.slug from deal_cards dc join credit_cards cc on cc.id = dc.card_id where dc.deal_id = ${id} order by cc.name`;
  return { deal, cards };
}

const optInt = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(/[.,\s]/g, ""))), z.number().int().min(0).nullable());
const optPct = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(",", "."))), z.number().min(0).max(100).nullable());
const optDate = z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable());
const optEnum = <T extends readonly [string, ...string[]]>(vals: T) => z.preprocess((v) => (v === "" ? null : v), z.enum(vals).nullable());
const optText = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().max(5000).nullable());

export const DealEditSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(5000),
  percentage: optPct,
  fixed_amount_vnd: optInt,
  maximum_benefit_vnd: optInt,
  cap_period: optEnum(CAP_PERIODS),
  cap_is_unlimited: z.preprocess((v) => (v === "true" ? true : v === "false" ? false : null), z.boolean().nullable()),
  minimum_spend_vnd: optInt,
  minimum_spend_period: optEnum(CAP_PERIODS),
  installment_months: z.preprocess((v) => (v === "" ? null : Number(v)), z.number().int().min(1).max(120).nullable()),
  installment_fee_vnd: optInt,
  eligibility_terms: optText,
  terms_and_conditions: optText,
  payment_channel: z.enum(PAYMENT_CHANNELS),
  start_date: optDate,
  end_date: optDate,
  verification_status: z.enum(VERIFICATION_STATUSES),
  publication_status: z.enum(PUBLICATION_STATUSES),
  is_featured: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});
export type DealEdit = z.infer<typeof DealEditSchema>;

export interface ActionResult {
  ok: boolean;
  message: string;
  errors?: string[];
  warnings?: string[];
}

export async function updateDeal(id: string, input: DealEdit, actorEmail: string): Promise<ActionResult> {
  const existing = await getAdminDeal(id);
  if (!existing) return { ok: false, message: "Không tìm thấy ưu đãi." };
  const d = existing.deal;
  const rules = checkDealRules({
    benefitType: d.benefit_type as never,
    offerType: d.offer_type as never,
    merchantScope: d.merchant_scope as never,
    hasMerchant: d.merchant_id !== null,
    percentage: input.percentage,
    fixedAmountVnd: input.fixed_amount_vnd,
    maximumBenefitVnd: input.maximum_benefit_vnd,
    capPeriod: input.cap_period,
    capIsUnlimited: input.cap_is_unlimited,
    minimumSpendVnd: input.minimum_spend_vnd,
    installmentMonths: input.installment_months,
    installmentFeeVnd: input.installment_fee_vnd,
    paymentChannel: input.payment_channel,
    startDate: input.start_date,
    endDate: input.end_date,
    verificationStatus: input.verification_status,
    publicationStatus: input.publication_status,
    hasSource: d.source_id !== null,
    sourceReviewed: d.source_verified_at !== null,
    cardCount: existing.cards.length,
  });
  if (rules.errors.length || rules.publishBlockers.length) {
    return { ok: false, message: "Chưa thể lưu thay đổi.", errors: [...rules.errors, ...rules.publishBlockers], warnings: rules.warnings };
  }
  try {
    await withAdminTx(async (tx) => {
      await tx`update deals set ${tx(input as Record<string, unknown>, Object.keys(input))} where id = ${id}`;
      await tx`insert into admin_audit_log ${tx({ actor_email: actorEmail, action: "update_deal", entity_type: "deal", entity_id: id, details: tx.json(JSON.parse(JSON.stringify(input))) })}`;
    });
  } catch (e) {
    return { ok: false, message: "Cơ sở dữ liệu từ chối thay đổi.", errors: [e instanceof Error ? e.message : String(e)] };
  }
  return { ok: true, message: "Đã lưu ưu đãi.", warnings: rules.warnings };
}

export async function setDealPublication(id: string, status: "published" | "draft" | "withdrawn", actorEmail: string): Promise<ActionResult> {
  try {
    await withAdminTx(async (tx) => {
      await tx`update deals set publication_status = ${status} where id = ${id}`;
      await tx`insert into admin_audit_log ${tx({ actor_email: actorEmail, action: `deal_${status}`, entity_type: "deal", entity_id: id, details: null })}`;
    });
    return { ok: true, message: status === "withdrawn" ? "Đã ngừng hiển thị ưu đãi." : status === "published" ? "Đã xuất bản." : "Đã chuyển về nháp." };
  } catch (e) {
    return { ok: false, message: "Không thể cập nhật trạng thái.", errors: [e instanceof Error ? e.message : String(e)] };
  }
}

/** Withdraws every published deal whose end date has passed. */
export async function withdrawExpiredDeals(actorEmail: string): Promise<ActionResult> {
  const today = todayInVietnam();
  const rows = await withAdminTx(async (tx) => {
    const r = await tx`update deals set publication_status = 'withdrawn' where publication_status = 'published' and end_date is not null and end_date < ${today}::date returning id`;
    await tx`insert into admin_audit_log ${tx({ actor_email: actorEmail, action: "withdraw_expired", entity_type: "deal", entity_id: null, details: tx.json({ count: r.length }) })}`;
    return r;
  });
  return { ok: true, message: `Đã ngừng hiển thị ${rows.length} ưu đãi hết hạn.` };
}

export async function listAdminCards() {
  return getSql()`
    select c.id, c.slug, c.name, c.verification_status, c.is_active, c.is_featured, c.is_demo, c.annual_fee_vnd, c.updated_at,
      b.name as bank_name, s.url as source_url, s.verified_at as source_verified_at
    from credit_cards c join banks b on b.id = c.bank_id left join sources s on s.id = c.source_id
    order by c.updated_at desc limit 500`;
}

export async function getAdminCard(id: string) {
  const [card] = await getSql()`select c.*, b.name as bank_name, s.url as source_url, s.verified_at as source_verified_at from credit_cards c join banks b on b.id = c.bank_id left join sources s on s.id = c.source_id where c.id = ${id}`;
  return card ?? null;
}

export const CardEditSchema = z.object({
  name: z.string().trim().min(1).max(200),
  network: optText,
  card_tier: optText,
  annual_fee_vnd: optInt,
  annual_fee_waiver_terms: optText,
  minimum_income_vnd: optInt,
  description: optText,
  verification_status: z.enum(VERIFICATION_STATUSES),
  is_active: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  is_featured: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});
export type CardEdit = z.infer<typeof CardEditSchema>;

export async function updateCard(id: string, input: CardEdit, actorEmail: string): Promise<ActionResult> {
  const card = await getAdminCard(id);
  if (!card) return { ok: false, message: "Không tìm thấy thẻ." };
  if (input.verification_status === "verified" && !card.source_verified_at) {
    return { ok: false, message: "Chưa thể xác minh thẻ.", errors: ["Thẻ cần nguồn đã được duyệt trước khi xác minh."] };
  }
  try {
    await withAdminTx(async (tx) => {
      await tx`update credit_cards set ${tx(input as Record<string, unknown>, Object.keys(input))} where id = ${id}`;
      await tx`insert into admin_audit_log ${tx({ actor_email: actorEmail, action: "update_card", entity_type: "card", entity_id: id, details: tx.json(JSON.parse(JSON.stringify(input))) })}`;
    });
  } catch (e) {
    return { ok: false, message: "Cơ sở dữ liệu từ chối thay đổi.", errors: [e instanceof Error ? e.message : String(e)] };
  }
  return { ok: true, message: "Đã lưu thẻ." };
}

export async function listAdminSources() {
  return getSql()`
    select s.*, (select count(*)::int from deals d where d.source_id = s.id) as deal_count,
      (select count(*)::int from credit_cards c where c.source_id = s.id) as card_count
    from sources s order by s.verified_at nulls first, s.retrieved_at desc limit 500`;
}

export async function setSourceReviewed(id: string, reviewed: boolean, notes: string | null, actorEmail: string): Promise<ActionResult> {
  const [src] = await getSql()`select url from sources where id = ${id}`;
  if (!src) return { ok: false, message: "Không tìm thấy nguồn." };
  try {
    const u = new URL(src.url as string);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
  } catch {
    return { ok: false, message: "URL nguồn không hợp lệ." };
  }
  await withAdminTx(async (tx) => {
    await tx`update sources set verified_at = ${reviewed ? new Date().toISOString() : null}::timestamptz, verification_notes = coalesce(${notes}, verification_notes) where id = ${id}`;
    await tx`insert into admin_audit_log ${tx({ actor_email: actorEmail, action: reviewed ? "source_reviewed" : "source_unreviewed", entity_type: "source", entity_id: id, details: null })}`;
  });
  return { ok: true, message: reviewed ? "Đã đánh dấu nguồn đã duyệt." : "Đã bỏ duyệt nguồn; các ưu đãi phụ thuộc đã bị gỡ xuất bản." };
}

export async function adminDashboardStats() {
  const sql = getSql();
  const [counts] = await sql`
    select
      (select count(*)::int from deals where publication_status = 'published') as published,
      (select count(*)::int from deals where verification_status = 'needs_review') as needs_review,
      (select count(*)::int from deals where publication_status = 'draft') as drafts,
      (select count(*)::int from deals where publication_status = 'published' and end_date < ${todayInVietnam()}::date) as expired_published,
      (select count(*)::int from sources where verified_at is null) as unreviewed_sources,
      (select count(*)::int from credit_cards where verification_status <> 'verified') as unverified_cards`;
  const audit = await sql`select actor_email, action, entity_type, created_at from admin_audit_log order by created_at desc limit 10`;
  return { counts, audit };
}
