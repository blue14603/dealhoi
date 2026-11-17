/**
 * Shared types for the bank crawler.
 *
 * Each bank has an adapter that answers two questions:
 *   1. Which URLs are promotions?            (discover)
 *   2. What does one promotion page say?     (parse)
 * Everything else (fetching, robots.txt, change detection, LLM extraction,
 * validation and the import bundle) is shared in crawler/core.
 */

export type Fetcher = (url: string) => Promise<{ status: number; text: string }>;

export interface DiscoveredUrl {
  url: string;
  lastmod: string | null;
}

export interface Discovery {
  promos: DiscoveredUrl[];
  cards: DiscoveredUrl[];
  /** Sitemap URLs that look like promotions but match no configured pattern. */
  unmatched: string[];
}

/** A card that a promotion says it applies to, as the bank labels it. */
export interface BankCardRef {
  /** The bank's own key, e.g. "the-tin-dung-techcombank-visa-signature". */
  key: string;
  /** Display name from the bank, e.g. "Thẻ Techcombank Visa Signature". */
  title: string;
  /** DealHoi card slug after applying the adapter's mapping. */
  slug: string;
}

/** Bank-independent view of one promotion page, produced by an adapter. */
export interface ParsedPromo {
  url: string;
  title: string;
  /** Plain text of the offer, which the LLM reads and the validator checks against. */
  text: string;
  /** End of validity as YYYY-MM-DD in Vietnam time, when the bank publishes it as data. */
  expiryDate: string | null;
  /** True when the bank labels the offer as applying to at least one credit card. */
  isCreditCard: boolean;
  /** Credit cards the bank lists for this offer (debit cards already removed). */
  creditCards: BankCardRef[];
  merchants: { key: string; title: string }[];
  /** The bank's own category labels; passed to the LLM as hints only. */
  categoryHints: string[];
  /** Membership / segment restrictions (e.g. Priority only). */
  membership: string[];
  /** Linked terms & conditions documents (usually PDFs). */
  documents: { title: string; url: string }[];
  /** Stable hash of the structured content, used for change detection. */
  contentHash: string;
}

export interface BankAdapter {
  slug: string;
  name: string;
  websiteUrl: string;
  discover(fetcher: Fetcher): Promise<Discovery>;
  /** Returns null when the page has no recognisable promotion data. */
  parse(url: string, html: string): ParsedPromo | null;
  /** Maps the bank's merchant key to a DealHoi merchant slug candidate. */
  merchantSlug(key: string): string;
}
