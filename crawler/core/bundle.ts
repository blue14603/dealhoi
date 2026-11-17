/**
 * Turns validated offers into DealHoi import bundles.
 *
 * Two files are produced:
 *  - the main bundle (sources + deals), safe to import on every run;
 *  - a stubs bundle (cards + new merchants) to import once and then complete
 *    by hand. Stubs are kept separate because the importer overwrites every
 *    field of an existing card, which would erase fees entered manually.
 */
import { createHash } from "node:crypto";
import { DealImportSchema, type DealImport, type SourceImport } from "@/lib/admin/import-schema";
import type { Offer } from "./extract";
import { MAX_MERCHANTS_PER_OFFER, resolveMerchant, type KnownMerchant } from "./merchants";
import type { BankAdapter, ParsedPromo } from "./types";

export interface Bundles {
  main: { sources: SourceImport[]; deals: DealImport[] };
  stubs: { cards: Record<string, unknown>[]; merchants: Record<string, unknown>[] };
  invalid: { importKey: string; problems: string[] }[];
}

export function importKey(bankSlug: string, url: string, index: number): string {
  const slug = url.split("/").pop()!.toLowerCase();
  const base = slug.length > 120 ? `${slug.slice(0, 110)}-${createHash("sha1").update(slug).digest("hex").slice(0, 8)}` : slug;
  return `${bankSlug}:${base}#${index + 1}`;
}

/** Stable order so the same page yields the same import keys on re-runs. */
export function sortOffers(offers: Offer[]): Offer[] {
  const key = (o: Offer) =>
    [o.benefit_type, o.merchant_names.join(","), String(o.minimum_spend_vnd ?? -1).padStart(13, "0"), String(o.fixed_amount_vnd ?? -1).padStart(13, "0"), String(o.percentage ?? -1).padStart(6, "0"), o.title].join("|");
  return [...offers].sort((a, b) => key(a).localeCompare(key(b)));
}

/**
 * Deterministic fixes for fields the model often fills inconsistently:
 * points are not VND, and a cap period without a cap amount is meaningless
 * (deal-rules refuses "cap_period cần maximum_benefit_vnd").
 */
export function normalizeOffer(offer: Offer): Offer {
  const o = { ...offer };
  if (o.benefit_type === "points") {
    o.fixed_amount_vnd = null;
    o.maximum_benefit_vnd = null;
  }
  if (o.maximum_benefit_vnd === null) {
    o.cap_period = null;
    if (o.cap_is_unlimited === false) o.cap_is_unlimited = null;
  }
  if (o.cap_is_unlimited === true) o.maximum_benefit_vnd = null;
  if (o.minimum_spend_vnd === null) o.minimum_spend_period = null;
  // Online shopping is for online shops only; an in-store offer falls back to general spending.
  if (o.category_slug === "mua-sam-truc-tuyen" && o.payment_channel === "offline") o.category_slug = "chi-tieu-chung";
  return o;
}

function joinText(...parts: (string | null | undefined)[]): string | null {
  const s = parts.filter((p) => p && p.trim()).join("\n");
  return s ? s.slice(0, 5000) : null;
}

export function buildBundles(args: {
  bank: BankAdapter;
  results: { promo: ParsedPromo; offers: Offer[] }[];
  retrievedAt: string;
  knownMerchants: KnownMerchant[];
  cardPageBySlug: Map<string, string>;
}): Bundles {
  const { bank } = args;
  const bundles: Bundles = { main: { sources: [], deals: [] }, stubs: { cards: [], merchants: [] }, invalid: [] };
  const cardStubs = new Map<string, Record<string, unknown>>();
  const merchantStubs = new Map<string, Record<string, unknown>>();

  for (const { promo, offers } of args.results) {
    if (!offers.length) continue;
    bundles.main.sources.push({
      url: promo.url,
      publisher: bank.name,
      source_type: "official_bank",
      source_excerpt: promo.text.slice(0, 5000),
      published_at: null,
      retrieved_at: args.retrievedAt,
      verified_at: null,
      verification_notes: null,
      is_demo: false,
    });

    const restricted = promo.membership.filter((m) => !/tất cả/i.test(m));
    const docs = promo.documents.length
      ? `Điều khoản đầy đủ: ${promo.documents.map((d) => `${d.title} (${d.url})`).join("; ")}`
      : null;

    sortOffers(offers.map(normalizeOffer)).forEach((offer, index) => {
      const cards = offer.card_keys.length
        ? promo.creditCards.filter((c) => offer.card_keys.includes(c.key))
        : promo.creditCards;
      for (const c of cards) {
        if (!cardStubs.has(c.slug)) {
          cardStubs.set(c.slug, {
            slug: c.slug,
            bank_slug: bank.slug,
            name: c.title.replace(/^Thẻ\s+(tín dụng\s+)?/i, "").trim(),
            network: /mastercard/i.test(c.title) ? "Mastercard" : /visa/i.test(c.title) ? "Visa" : null,
            card_tier: null,
            annual_fee_vnd: null,
            official_url: args.cardPageBySlug.get(c.slug) ?? null,
            verification_status: "draft",
            is_active: true,
          });
        }
      }

      // One deal per merchant, so each shows up when searching that merchant.
      const names = offer.merchant_scope === "specific_merchant" ? offer.merchant_names : [];
      const split = names.length > 0 && names.length <= MAX_MERCHANTS_PER_OFFER;
      const merchants = split
        ? names.map((n) => resolveMerchant(n, args.knownMerchants, promo.merchants, (k) => bank.merchantSlug(k)))
        : [null];
      const tooMany = names.length > MAX_MERCHANTS_PER_OFFER ? `Áp dụng tại: ${names.join(", ")}` : null;
      const seen = new Set<string>();

      for (const m of merchants) {
        if (m && seen.has(m.slug)) continue;
        if (m) seen.add(m.slug);
        if (m && !m.known && !merchantStubs.has(m.slug)) {
          merchantStubs.set(m.slug, { slug: m.slug, name: m.name, category_slug: offer.category_slug, aliases: [] });
        }
        const base = importKey(bank.slug, promo.url, index);
        const key = m && merchants.length > 1 ? `${base}-${m.slug.slice(0, 30).replace(/-+$/, "")}` : base;
        const deal = DealImportSchema.safeParse({
          import_key: key,
          title: offer.title,
          description: offer.description,
          merchant_slug: m?.slug ?? null,
          category_slug: offer.category_slug,
          benefit_type: offer.benefit_type,
          offer_type: offer.offer_type,
          percentage: offer.percentage,
          fixed_amount_vnd: offer.fixed_amount_vnd,
          maximum_benefit_vnd: offer.maximum_benefit_vnd,
          cap_period: offer.cap_period,
          cap_is_unlimited: offer.cap_is_unlimited,
          minimum_spend_vnd: offer.minimum_spend_vnd,
          minimum_spend_period: offer.minimum_spend_period,
          installment_months: offer.installment_months,
          installment_fee_vnd: offer.installment_fee_vnd,
          eligibility_terms: joinText(offer.eligibility_terms, restricted.length ? `Dành cho: ${restricted.join(", ")}` : null),
          terms_and_conditions: joinText(offer.terms_and_conditions, tooMany, docs),
          payment_channel: offer.payment_channel,
          merchant_scope: m ? "specific_merchant" : offer.merchant_scope === "specific_merchant" ? "category_wide" : offer.merchant_scope,
          start_date: offer.start_date,
          end_date: offer.end_date ?? promo.expiryDate,
          source_url: promo.url,
          verification_status: "draft",
          publication_status: "draft",
          cards: cards.map((c) => ({ card_slug: c.slug, additional_eligibility_terms: null })),
        });
        if (deal.success) bundles.main.deals.push(deal.data);
        else bundles.invalid.push({ importKey: key, problems: deal.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
      }
    });
  }

  bundles.stubs.cards = [...cardStubs.values()];
  bundles.stubs.merchants = [...merchantStubs.values()];
  return bundles;
}
