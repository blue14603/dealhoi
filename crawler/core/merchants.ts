/**
 * Turns merchant names written on a promotion page into DealHoi merchant
 * slugs: an existing merchant when the name matches its name, alias or slug,
 * otherwise a new slug derived from the name (imported as a stub).
 */
import { normalizeText } from "@/lib/domain/text";

export interface KnownMerchant {
  slug: string;
  name: string;
  aliases?: string[];
}

export interface ResolvedMerchant {
  slug: string;
  name: string;
  known: boolean;
}

/** More merchants than this in one offer are kept as text, not split into deals. */
export const MAX_MERCHANTS_PER_OFFER = 8;

export function slugify(name: string): string {
  return normalizeText(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

const compact = (s: string) => normalizeText(s).replace(/[^a-z0-9]/g, "");

export function resolveMerchant(
  name: string,
  known: KnownMerchant[],
  bankMerchants: { key: string; title: string }[],
  bankSlug: (key: string) => string,
): ResolvedMerchant {
  const target = compact(name);
  const match = (m: KnownMerchant) => [m.slug, m.name, ...(m.aliases ?? [])].some((x) => compact(x) === target);
  const hit = known.find(match);
  if (hit) return { slug: hit.slug, name: hit.name, known: true };

  const bank = bankMerchants.find((m) => compact(m.title) === target || compact(m.key) === target);
  if (bank) {
    const slug = bankSlug(bank.key);
    const byBankSlug = known.find((m) => m.slug === slug);
    return byBankSlug ? { slug, name: byBankSlug.name, known: true } : { slug, name: bank.title, known: false };
  }
  return { slug: slugify(name), name: name.trim(), known: false };
}
