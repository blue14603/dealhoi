/**
 * Techcombank adapter.
 *
 * Discovery: the sitemap index lists every promotion and card page.
 *   Promotions: /khach-hang-ca-nhan/uu-dai/<slug>
 *               /khach-hang-ca-nhan/chi-tieu/the/khuyen-mai/<slug>   (older section)
 *   Cards:      /khach-hang-ca-nhan/chi-tieu/the/the-tin-dung/<slug>
 *
 * Parsing: each promotion page embeds its data as JSON in the `data-cf`
 * attribute of <tcb-promotion-detail>, so no browser is needed. Expiry,
 * eligible cards, product type, merchant and categories are read directly;
 * only the free-text offer description goes to the LLM.
 *
 * Known quirk: `isOutdated` is not reliable (it stays false after expiry), so
 * the crawler compares `expiryDateTime` with today's date instead.
 */
import { createHash } from "node:crypto";
import { htmlToText, readAttribute, readLinks } from "../core/html";
import { collectSitemapUrls } from "../core/sitemap";
import type { ParsedCardPage } from "../core/cards";
import type { BankAdapter, BankCardRef, Discovery, Fetcher, ParsedPromo } from "../core/types";

const ORIGIN = "https://techcombank.com";
const SITEMAP = `${ORIGIN}/sitemap-index.xml`;

const PROMO_PATTERNS = [
  /^https:\/\/techcombank\.com\/khach-hang-ca-nhan\/uu-dai\/[A-Za-z0-9-]+$/,
  /^https:\/\/techcombank\.com\/khach-hang-ca-nhan\/chi-tieu\/the\/khuyen-mai\/[A-Za-z0-9-]+$/,
];
const CARD_PATTERN = /^https:\/\/techcombank\.com\/khach-hang-ca-nhan\/chi-tieu\/the\/the-tin-dung\/([a-z0-9-]+)$/;
/** Pages under the card path that are features, not cards. */
const CARD_EXCLUDE = new Set(["tra-gop", "thanh-toan-voi-google-pay"]);

/**
 * Promotions whose slug contains one of these words are never credit card
 * offers (insurance, accounts, savings, merchants, staff). They are skipped
 * before fetching. The page's own product type is the real filter; this list
 * only saves requests.
 */
export const SLUG_BLOCKLIST = [
  "bao-hiem",
  "song-an",
  "tai-khoan",
  "chung-chi-tien-gui",
  "lai-suat",
  "sinh-loi",
  "merchant",
  "softpos",
  "hkd",
  "etax",
  "nhan-vien",
  "can-bo",
  "techcom-securities",
  "chuyen-tien-quoc-te",
];

/** URLs containing these words but matching no pattern are reported for review. */
const PROMO_HINTS = /(uu-dai|khuyen-mai|hoan-tien|giam-gia|chuong-trinh|ctkm)/;
/**
 * Sections that are never credit card promotions (business banking, loans,
 * savings, tools, SEO articles). Their URLs are not reported as unmatched.
 * Announcements (/thong-tin/thong-bao/) stay reported: new ones can announce
 * changes to card benefits.
 */
const IGNORED_SECTIONS = [
  "/thong-tin/blog/",
  "/khach-hang-doanh-nghiep/",
  "/ho-kinh-doanh-va-doanh-nghiep-nho/",
  "/khach-hang-ca-nhan/tiet-kiem/",
  "/khach-hang-ca-nhan/vay/",
  "/cong-cu-tien-ich/",
];
/** Listing pages of the known sections; not promotions themselves. */
const LISTING_PAGES = new Set([
  `${ORIGIN}/khach-hang-ca-nhan/uu-dai`,
  `${ORIGIN}/khach-hang-ca-nhan/chi-tieu/the/khuyen-mai`,
]);

/**
 * Card keys in promotions differ from card page slugs. The default mapping
 * strips the "the-tin-dung-" prefix; add exceptions here once confirmed
 * against the card pages (the run report lists keys with no card page).
 */
export const CARD_KEY_ALIASES: Record<string, string> = {
  // Card page: /khach-hang-ca-nhan/chi-tieu/the/the-tin-dung/techcombank-visa-eco
  "techcombank-visa-eco-card": "techcombank-visa-eco",
  // The Galle Watch page lists this key as the credit card "Techcombank Visa Private";
  // card page: /khach-hang-ca-nhan/chi-tieu/the/the-tin-dung/techcombank-private-visa-infinite
  "the-tin-dung-techcombank-visa-infinite": "techcombank-private-visa-infinite",
};

export function cardSlugFromKey(key: string): string {
  if (CARD_KEY_ALIASES[key]) return CARD_KEY_ALIASES[key];
  return key.replace(/^the-tin-dung-/, "").replace(/[^a-z0-9-]/g, "");
}

function isBlockedSlug(url: string): boolean {
  const slug = url.split("/").pop()!.toLowerCase();
  return SLUG_BLOCKLIST.some((w) => slug.includes(w));
}

export function classifyUrls(urls: { url: string; lastmod: string | null }[]): Discovery & { blocked: string[] } {
  const promos: Discovery["promos"] = [];
  const cards: Discovery["cards"] = [];
  const unmatched: string[] = [];
  const blocked: string[] = [];
  for (const u of urls) {
    const url = u.url.replace(/\/$/, "");
    const card = url.match(CARD_PATTERN);
    if (card) {
      if (!CARD_EXCLUDE.has(card[1])) cards.push({ ...u, url });
      continue;
    }
    if (PROMO_PATTERNS.some((p) => p.test(url))) {
      if (isBlockedSlug(url)) blocked.push(url);
      else promos.push({ ...u, url });
      continue;
    }
    const path = url.replace(ORIGIN, "");
    if (!PROMO_HINTS.test(path) || LISTING_PAGES.has(url) || path.startsWith("/en/")) continue;
    if (IGNORED_SECTIONS.some((sec) => path.startsWith(sec))) continue;
    unmatched.push(url);
  }
  return { promos, cards, unmatched, blocked };
}

interface TcbTag {
  key: string;
  path?: string;
  title?: string;
}

interface TcbDetail {
  name?: string;
  description?: string;
  expiryDate?: string;
  expiryDateTime?: string;
  categories?: TcbTag[];
  cardTypes?: TcbTag[];
  productTypes?: TcbTag[];
  merchant?: TcbTag[];
  membership?: TcbTag[];
  noteContent?: string | null;
  promotionContent?: string | null;
  excerptContent?: string | null;
  applicableContent?: string | null;
  applicableTimeContent?: string | null;
  productsSubtitle?: string | null;
  locationSubtitle?: string | null;
}

/** "30/04/2026 23:59:00" or "30/04/2026" → "2026-04-30". */
export function parseVnDate(s: string | undefined | null): string | null {
  const m = s?.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

export function parsePromotionPage(url: string, html: string): ParsedPromo | null {
  const raw = readAttribute(html, "tcb-promotion-detail", "data-cf");
  if (!raw) return null;
  let detail: TcbDetail;
  try {
    detail = (JSON.parse(raw) as { detail?: TcbDetail }).detail ?? {};
  } catch {
    return null;
  }
  if (!detail.promotionContent && !detail.description) return null;

  const creditCards: BankCardRef[] = (detail.cardTypes ?? [])
    .filter((c) => (c.path ?? "").includes("/card-types/the-tin-dung/") || c.key.startsWith("the-tin-dung-"))
    .map((c) => ({ key: c.key, title: (c.title ?? c.key).trim(), slug: cardSlugFromKey(c.key) }));
  const isCreditCard =
    creditCards.length > 0 || (detail.productTypes ?? []).some((p) => p.key.startsWith("the-tin-dung"));

  const sections: [string, string | null | undefined][] = [
    ["Nội dung ưu đãi", detail.promotionContent],
    ["Thời gian áp dụng", detail.applicableTimeContent],
    ["Đối tượng áp dụng", detail.applicableContent],
    ["Sản phẩm áp dụng", detail.productsSubtitle],
    ["Địa điểm áp dụng", detail.locationSubtitle],
    ["Tóm tắt", detail.excerptContent],
  ];
  const body = sections
    .filter(([, v]) => v && v.trim())
    .map(([h, v]) => `## ${h}\n${htmlToText(v!)}`)
    .join("\n\n");
  const title = (detail.description || detail.name || "").trim();
  const text = `${title}\n\n${body}`.trim();

  const documents = readLinks(detail.noteContent ?? "")
    .filter((l) => l.href)
    .map((l) => ({ title: l.title, url: new URL(l.href, ORIGIN).toString() }));

  const hashInput = JSON.stringify([
    title,
    detail.expiryDateTime ?? detail.expiryDate ?? null,
    body,
    (detail.cardTypes ?? []).map((c) => c.key).sort(),
    (detail.productTypes ?? []).map((c) => c.key).sort(),
    (detail.merchant ?? []).map((c) => c.key).sort(),
    documents.map((d) => d.url),
  ]);

  return {
    url,
    title,
    text,
    expiryDate: parseVnDate(detail.expiryDateTime) ?? parseVnDate(detail.expiryDate),
    isCreditCard,
    creditCards,
    merchants: (detail.merchant ?? []).map((m) => ({ key: m.key, title: (m.title ?? m.key).trim() })),
    categoryHints: (detail.categories ?? []).map((c) => (c.title ?? c.key).trim()),
    membership: (detail.membership ?? []).map((m) => (m.title ?? m.key).trim()),
    documents,
    contentHash: createHash("sha256").update(hashInput).digest("hex"),
  };
}

/**
 * Card pages have no embedded JSON: the content sits in "list-tile" blocks
 * (fees, benefits, conditions). Read those blocks; fall back to the page body
 * without navigation, header, footer and scripts.
 */
export function parseCardPage(url: string, html: string): ParsedCardPage | null {
  const slug = url.replace(/\/$/, "").split("/").pop()!;
  const title = htmlToText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? slug).trim();
  const clean = html.replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, " ");

  const blocks: string[] = [];
  const parts = clean.split(/class="list-tile__card-content"/i).slice(1);
  for (const part of parts) {
    const end = part.search(/class="list-tile(?!__card-body)|<footer\b/i);
    const inner = (end > 0 ? part.slice(0, end) : part).slice(part.indexOf(">") + 1, 8000);
    const text = htmlToText(inner);
    if (text && !blocks.includes(text)) blocks.push(text);
  }
  let body = blocks.join("\n\n");
  if (body.length < 200) {
    const main = clean.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? clean.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? clean;
    body = htmlToText(main.replace(/<(nav|header|footer)\b[\s\S]*?<\/\1>/gi, " ")).slice(0, 30000);
  }
  if (body.length < 100) return null;
  const text = `${title}\n\n${body}`.trim();
  return { url, slug, title, text, contentHash: createHash("sha256").update(text).digest("hex") };
}

export const techcombank: BankAdapter & { lastBlocked: string[] } = {
  slug: "techcombank",
  name: "Techcombank",
  websiteUrl: ORIGIN,
  lastBlocked: [],
  async discover(fetcher: Fetcher) {
    // Only the Vietnamese child sitemaps; the English ones duplicate them.
    const urls = await collectSitemapUrls(fetcher, SITEMAP, (u) => /\.vi-[a-z-]*sitemap\.xml$/.test(u));
    const { blocked, ...discovery } = classifyUrls(urls);
    this.lastBlocked = blocked;
    return discovery;
  },
  parse: parsePromotionPage,
  parseCardPage,
  merchantSlug(key: string) {
    return key
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  },
};
