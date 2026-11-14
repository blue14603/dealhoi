import "server-only";
import { config } from "@/lib/config";
import { withPublicRead, type TxSql } from "@/lib/db/client";
import type {
  BankRef,
  BenefitType,
  CardRecord,
  CardWithDeals,
  CategoryRef,
  DealRecord,
  PaymentChannel,
  SourceRecord,
} from "@/lib/domain/types";
import { getDealLifecycle, todayInVietnam } from "@/lib/domain/validity";

/**
 * Public, read-only catalogue queries. Every query:
 *  - runs under the database's public role (RLS applies),
 *  - only returns verified/published records with explicit WHERE filters,
 *  - excludes demonstration data unless DEALHOI_DEMO_DATA is enabled.
 * No user input is ever interpolated as SQL; all values are bound parameters.
 */

const demo = () => config.includeDemoData;

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, (c) => `\\${c}`);
}

export interface MerchantRow {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  isFeatured: boolean;
  category: CategoryRef;
}

export interface CategoryRow extends CategoryRef {
  description: string | null;
  isBrowsable: boolean;
}

function toSource(r: Record<string, unknown> | null): SourceRecord | null {
  if (!r || !r.id) return null;
  const ts = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    id: r.id as string,
    url: r.url as string,
    publisher: r.publisher as string,
    sourceType: r.source_type as SourceRecord["sourceType"],
    sourceExcerpt: (r.source_excerpt as string) ?? null,
    publishedAt: ts(r.published_at),
    retrievedAt: ts(r.retrieved_at) as string,
    verifiedAt: ts(r.verified_at),
    verificationNotes: (r.verification_notes as string) ?? null,
    isDemo: Boolean(r.is_demo),
  };
}

function toDeal(r: Record<string, unknown>): DealRecord {
  return {
    id: r.id as string,
    title: r.title as string,
    description: r.description as string,
    merchant: r.merchant_id ? { id: r.merchant_id as string, slug: r.merchant_slug as string, name: r.merchant_name as string } : null,
    category: { id: r.category_id as string, slug: r.category_slug as string, name: r.category_name as string, icon: (r.category_icon as string) ?? null },
    benefitType: r.benefit_type as DealRecord["benefitType"],
    offerType: r.offer_type as DealRecord["offerType"],
    percentage: (r.percentage as number | null) ?? null,
    fixedAmountVnd: (r.fixed_amount_vnd as number | null) ?? null,
    maximumBenefitVnd: (r.maximum_benefit_vnd as number | null) ?? null,
    capPeriod: (r.cap_period as DealRecord["capPeriod"]) ?? null,
    capIsUnlimited: (r.cap_is_unlimited as boolean | null) ?? null,
    minimumSpendVnd: (r.minimum_spend_vnd as number | null) ?? null,
    minimumSpendPeriod: (r.minimum_spend_period as DealRecord["minimumSpendPeriod"]) ?? null,
    installmentMonths: (r.installment_months as number | null) ?? null,
    installmentFeeVnd: (r.installment_fee_vnd as number | null) ?? null,
    eligibilityTerms: (r.eligibility_terms as string) ?? null,
    termsAndConditions: (r.terms_and_conditions as string) ?? null,
    paymentChannel: r.payment_channel as DealRecord["paymentChannel"],
    merchantScope: r.merchant_scope as DealRecord["merchantScope"],
    startDate: (r.start_date as string) ?? null,
    endDate: (r.end_date as string) ?? null,
    verificationStatus: r.verification_status as DealRecord["verificationStatus"],
    publicationStatus: r.publication_status as DealRecord["publicationStatus"],
    isFeatured: Boolean(r.is_featured),
    isDemo: Boolean(r.is_demo),
    source: toSource(r.source as Record<string, unknown> | null),
    cards: ((r.cards as Record<string, unknown>[]) ?? []).map((c) => ({
      cardId: c.card_id as string,
      cardSlug: c.card_slug as string,
      cardName: c.card_name as string,
      bankSlug: c.bank_slug as string,
      bankName: c.bank_name as string,
      additionalEligibilityTerms: (c.additional_eligibility_terms as string) ?? null,
    })),
  };
}

function toCard(r: Record<string, unknown>): CardRecord {
  return {
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    bank: { id: r.bank_id as string, slug: r.bank_slug as string, name: r.bank_name as string, websiteUrl: (r.bank_website_url as string) ?? null, isDemo: Boolean(r.bank_is_demo) },
    network: (r.network as string) ?? null,
    cardTier: (r.card_tier as string) ?? null,
    annualFeeVnd: (r.annual_fee_vnd as number | null) ?? null,
    annualFeeWaiverTerms: (r.annual_fee_waiver_terms as string) ?? null,
    minimumIncomeVnd: (r.minimum_income_vnd as number | null) ?? null,
    description: (r.description as string) ?? null,
    imageUrl: (r.image_url as string) ?? null,
    officialUrl: (r.official_url as string) ?? null,
    verificationStatus: r.verification_status as CardRecord["verificationStatus"],
    isActive: Boolean(r.is_active),
    isFeatured: Boolean(r.is_featured),
    isDemo: Boolean(r.is_demo),
    updatedAt: new Date(r.updated_at as string).toISOString(),
    source: toSource(r.source as Record<string, unknown> | null),
  };
}

export interface DealFilter {
  ids?: string[];
  merchantId?: string;
  categoryId?: string;
  cardId?: string;
  /** Purchase-first retrieval for a merchant: specific + category-wide + general offers. */
  forMerchant?: { id: string; categoryId: string };
  /** Purchase-first retrieval for a category. */
  forCategory?: { id: string };
  bankSlug?: string;
  benefitType?: BenefitType;
  channel?: PaymentChannel;
  featuredOnly?: boolean;
  query?: string;
  /** Include welcome offers (card-level sign-up bonuses). Excluded from purchase comparisons. */
  includeWelcome?: boolean;
  limit?: number;
}

async function queryDeals(sql: TxSql, f: DealFilter): Promise<DealRecord[]> {
  const includeDemo = demo();
  const q = f.query?.trim() ? `%${escapeLike(f.query.trim().slice(0, 100))}%` : null;
  const rows = await sql`
    with visible_cards as (
      select dc.deal_id, json_agg(json_build_object(
        'card_id', c.id, 'card_slug', c.slug, 'card_name', c.name,
        'bank_slug', b.slug, 'bank_name', b.name,
        'additional_eligibility_terms', dc.additional_eligibility_terms
      ) order by b.name, c.name) as cards,
      array_agg(b.slug) as bank_slugs,
      array_agg(c.id) as card_ids
      from deal_cards dc
      join credit_cards c on c.id = dc.card_id and c.verification_status = 'verified' and c.is_active
        and (${includeDemo}::boolean or not c.is_demo)
      join banks b on b.id = c.bank_id and (${includeDemo}::boolean or not b.is_demo)
      group by dc.deal_id
    )
    select d.*, m.slug as merchant_slug, m.name as merchant_name,
      cat.slug as category_slug, cat.name as category_name, cat.icon as category_icon,
      to_jsonb(s.*) as source, vc.cards
    from deals d
    join categories cat on cat.id = d.category_id
    left join merchants m on m.id = d.merchant_id
    join sources s on s.id = d.source_id and s.verified_at is not null
    join visible_cards vc on vc.deal_id = d.id
    where d.publication_status = 'published'
      and d.verification_status = 'verified'
      and (${includeDemo}::boolean or not d.is_demo)
      and (${f.ids ?? null}::uuid[] is null or d.id = any(${f.ids ?? null}::uuid[]))
      and (${f.merchantId ?? null}::uuid is null or d.merchant_id = ${f.merchantId ?? null}::uuid)
      and (${f.categoryId ?? null}::uuid is null or d.category_id = ${f.categoryId ?? null}::uuid)
      and (${f.cardId ?? null}::uuid is null or ${f.cardId ?? null}::uuid = any(vc.card_ids))
      and (${f.forMerchant?.id ?? null}::uuid is null or (
        (d.merchant_scope = 'specific_merchant' and d.merchant_id = ${f.forMerchant?.id ?? null}::uuid)
        or (d.merchant_scope = 'category_wide' and d.category_id = ${f.forMerchant?.categoryId ?? null}::uuid)
        or d.merchant_scope = 'general'))
      and (${f.forCategory?.id ?? null}::uuid is null or (
        d.category_id = ${f.forCategory?.id ?? null}::uuid
        or m.category_id = ${f.forCategory?.id ?? null}::uuid
        or d.merchant_scope = 'general'))
      and (${f.bankSlug ?? null}::text is null or ${f.bankSlug ?? null}::text = any(vc.bank_slugs))
      and (${f.benefitType ?? null}::text is null or d.benefit_type::text = ${f.benefitType ?? null}::text)
      and (${f.channel ?? null}::text is null or d.payment_channel::text = ${f.channel ?? null}::text
           or (d.payment_channel = 'both' and ${f.channel ?? null}::text in ('online', 'offline')))
      and (not ${f.featuredOnly ?? false}::boolean or d.is_featured)
      and (${f.includeWelcome ?? false}::boolean or d.offer_type <> 'welcome')
      and (${q}::text is null
        or public.dh_normalize(d.title) like public.dh_normalize(${q}::text)
        or public.dh_normalize(coalesce(m.name, '')) like public.dh_normalize(${q}::text)
        or public.dh_normalize(cat.name) like public.dh_normalize(${q}::text)
        or exists (select 1 from unnest(coalesce(m.aliases, '{}') || cat.aliases) a where public.dh_normalize(a) like public.dh_normalize(${q}::text)))
    order by d.is_featured desc, d.end_date asc nulls last, d.title
    limit ${f.limit ?? 200}
  `;
  return rows.map(toDeal);
}

export async function listDeals(f: DealFilter = {}): Promise<DealRecord[]> {
  return withPublicRead((sql) => queryDeals(sql, f));
}

/** Only deals that are active today (Vietnam time). */
export async function listActiveDeals(f: DealFilter = {}): Promise<DealRecord[]> {
  const today = todayInVietnam();
  return (await listDeals(f)).filter((d) => getDealLifecycle(d, today) === "active");
}

async function queryCards(sql: TxSql, f: { slug?: string; ids?: string[]; bankSlug?: string; categorySlug?: string; featuredOnly?: boolean; query?: string }) {
  const includeDemo = demo();
  const q = f.query?.trim() ? `%${escapeLike(f.query.trim().slice(0, 100))}%` : null;
  const rows = await sql`
    select c.*, b.slug as bank_slug, b.name as bank_name, b.website_url as bank_website_url, b.is_demo as bank_is_demo,
      to_jsonb(s.*) as source
    from credit_cards c
    join banks b on b.id = c.bank_id and (${includeDemo}::boolean or not b.is_demo)
    join sources s on s.id = c.source_id and s.verified_at is not null
    where c.verification_status = 'verified' and c.is_active
      and (${includeDemo}::boolean or not c.is_demo)
      and (${f.slug ?? null}::text is null or c.slug = ${f.slug ?? null}::text)
      and (${f.ids ?? null}::uuid[] is null or c.id = any(${f.ids ?? null}::uuid[]))
      and (${f.bankSlug ?? null}::text is null or b.slug = ${f.bankSlug ?? null}::text)
      and (not ${f.featuredOnly ?? false}::boolean or c.is_featured)
      and (${q}::text is null or public.dh_normalize(c.name) like public.dh_normalize(${q}::text)
           or public.dh_normalize(b.name) like public.dh_normalize(${q}::text))
      and (${f.categorySlug ?? null}::text is null or exists (
        select 1 from deal_cards dc join deals d on d.id = dc.deal_id join categories cat on cat.id = d.category_id
        where dc.card_id = c.id and d.publication_status = 'published' and d.verification_status = 'verified'
          and (d.end_date is null or d.end_date >= ${todayInVietnam()}::date)
          and (cat.slug = ${f.categorySlug ?? null}::text or d.merchant_scope = 'general')))
    order by c.is_featured desc, b.name, c.name
    limit 100
  `;
  return rows.map(toCard);
}

export async function listCards(f: { bankSlug?: string; categorySlug?: string; featuredOnly?: boolean; query?: string } = {}) {
  return withPublicRead((sql) => queryCards(sql, f));
}

export async function getCardBySlug(slug: string): Promise<CardWithDeals | null> {
  return withPublicRead(async (sql) => {
    const [card] = await queryCards(sql, { slug });
    if (!card) return null;
    const deals = await queryDeals(sql, { cardId: card.id, includeWelcome: true });
    return { ...card, deals };
  });
}

export async function getCardsByIds(ids: string[]): Promise<CardRecord[]> {
  if (!ids.length) return [];
  return withPublicRead((sql) => queryCards(sql, { ids }));
}

export async function listBanks(): Promise<BankRef[]> {
  const includeDemo = demo();
  return withPublicRead(async (sql) => {
    const rows = await sql`select id, slug, name, website_url, is_demo from banks where (${includeDemo}::boolean or not is_demo) order by is_demo, name`;
    return rows.map((r) => ({ id: r.id as string, slug: r.slug as string, name: r.name as string, websiteUrl: (r.website_url as string) ?? null, isDemo: Boolean(r.is_demo) }));
  });
}

export async function listCategories(opts: { browsableOnly?: boolean } = {}): Promise<CategoryRow[]> {
  return withPublicRead(async (sql) => {
    const rows = await sql`select * from categories where (not ${opts.browsableOnly ?? false}::boolean or is_browsable) order by sort_order, name`;
    return rows.map((r) => ({ id: r.id as string, slug: r.slug as string, name: r.name as string, icon: (r.icon as string) ?? null, description: (r.description as string) ?? null, isBrowsable: Boolean(r.is_browsable) }));
  });
}

function toMerchant(r: Record<string, unknown>): MerchantRow {
  return {
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    websiteUrl: (r.website_url as string) ?? null,
    logoUrl: (r.logo_url as string) ?? null,
    isFeatured: Boolean(r.is_featured),
    category: { id: r.category_id as string, slug: r.category_slug as string, name: r.category_name as string, icon: (r.category_icon as string) ?? null },
  };
}

export async function listMerchants(opts: { featuredOnly?: boolean; categoryId?: string } = {}): Promise<MerchantRow[]> {
  return withPublicRead(async (sql) => {
    const rows = await sql`
      select m.*, c.slug as category_slug, c.name as category_name, c.icon as category_icon
      from merchants m join categories c on c.id = m.category_id
      where (not ${opts.featuredOnly ?? false}::boolean or m.is_featured)
        and (${opts.categoryId ?? null}::uuid is null or m.category_id = ${opts.categoryId ?? null}::uuid)
      order by c.sort_order, m.name`;
    return rows.map(toMerchant);
  });
}

export async function getMerchantBySlug(slug: string): Promise<MerchantRow | null> {
  return withPublicRead(async (sql) => {
    const [r] = await sql`
      select m.*, c.slug as category_slug, c.name as category_name, c.icon as category_icon
      from merchants m join categories c on c.id = m.category_id where m.slug = ${slug}`;
    return r ? toMerchant(r) : null;
  });
}

export async function getCategoryBySlug(slug: string): Promise<CategoryRow | null> {
  const all = await listCategories();
  return all.find((c) => c.slug === slug) ?? null;
}

export interface SearchResults {
  query: string;
  merchants: MerchantRow[];
  categories: CategoryRow[];
  cards: CardRecord[];
}

/** Case- and Vietnamese-accent-insensitive search over merchants, categories, product aliases and cards. */
export async function searchCatalog(query: string, limit = 8): Promise<SearchResults> {
  const trimmed = query.trim().slice(0, 100);
  if (!trimmed) return { query: trimmed, merchants: [], categories: [], cards: [] };
  const pattern = `%${escapeLike(trimmed)}%`;
  return withPublicRead(async (sql) => {
    const merchants = await sql`
      select m.*, c.slug as category_slug, c.name as category_name, c.icon as category_icon,
        case when public.dh_normalize(m.name) = public.dh_normalize(${trimmed}) then 0
             when exists (select 1 from unnest(m.aliases) a where public.dh_normalize(a) = public.dh_normalize(${trimmed})) then 1
             else 2 end as rank
      from merchants m join categories c on c.id = m.category_id
      where public.dh_normalize(m.name) like public.dh_normalize(${pattern})
         or exists (select 1 from unnest(m.aliases) a where public.dh_normalize(a) like public.dh_normalize(${pattern}))
      order by rank, m.name limit ${limit}`;
    const categories = await sql`
      select *, case when public.dh_normalize(name) = public.dh_normalize(${trimmed}) then 0 else 1 end as rank
      from categories
      where is_browsable and (public.dh_normalize(name) like public.dh_normalize(${pattern})
         or exists (select 1 from unnest(aliases) a where public.dh_normalize(a) like public.dh_normalize(${pattern})))
      order by rank, sort_order limit ${limit}`;
    const cards = await queryCards(sql, { query: trimmed });
    return {
      query: trimmed,
      merchants: merchants.map(toMerchant),
      categories: categories.map((r) => ({ id: r.id as string, slug: r.slug as string, name: r.name as string, icon: (r.icon as string) ?? null, description: (r.description as string) ?? null, isBrowsable: true })),
      cards: cards.slice(0, limit),
    };
  });
}
