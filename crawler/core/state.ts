/**
 * Per-bank crawl state, so each run only fetches and extracts what is new or
 * changed. Stored as JSON under .crawl/state/<bank>.json (git-ignored).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type PageOutcome =
  | "extracted" // offers accepted (some may also be rejected)
  | "needs_manual" // all offers failed validation
  | "no_offers" // the model found no card offer
  | "duplicate" // same content as another promotion page
  | "not_credit_card" // the bank labels it as another product
  | "expired"
  | "unparseable" // no promotion data on the page
  | "error";

export interface PageState {
  hash: string | null;
  outcome: PageOutcome;
  firstSeen: string;
  lastChecked: string;
  expiryDate: string | null;
}

export interface CrawlState {
  pages: Record<string, PageState>;
  /** Promotion URL count from the previous run, for the health check. */
  lastPromoCount: number | null;
  /** Unmatched promotion-like URLs already reported, so only new ones are shown. */
  seenUnmatched?: string[];
  /**
   * Card and merchant slugs already written to a stubs file. Later runs only
   * write new ones, so re-importing never overwrites details entered by hand.
   */
  emittedStubs?: { cards: string[]; merchants: string[] };
}

export function loadState(path: string): CrawlState {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as CrawlState;
  } catch {
    return { pages: {}, lastPromoCount: null };
  }
}

export function saveState(path: string, state: CrawlState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2));
}
