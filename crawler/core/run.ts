import { isQuotaError, type StructuredCaller } from "@/lib/ai/openai-client";
import { buildBundles, type Bundles } from "./bundle";
import { extractOffers, type CategoryInfo, type ExtractionResult, type Offer } from "./extract";
import { RobotsDisallowedError } from "./http";
import type { KnownMerchant } from "./merchants";
import type { CrawlState, PageOutcome } from "./state";
import type { BankAdapter, Fetcher, ParsedPromo } from "./types";

export interface RunOptions {
  bank: BankAdapter;
  fetcher: Fetcher;
  /** null = parse only, no LLM extraction. */
  caller: StructuredCaller | null;
  state: CrawlState;
  today: string;
  retrievedAt: string;
  categories: CategoryInfo[];
  knownMerchants: KnownMerchant[];
  /** Maximum number of promotion pages to fetch this run. */
  limit?: number;
  /** Re-extract pages even when unchanged, and re-check expired ones. */
  force?: boolean;
  log?: (line: string) => void;
}

export interface PageReport {
  url: string;
  outcome: PageOutcome | "unchanged" | "parsed";
  title?: string;
  detail?: string;
  extraction?: ExtractionResult;
  /** Things a reviewer should double-check for this page. */
  reviewNotes?: string[];
}

/**
 * Flags a page whose offers at the same merchant(s) give different rewards to
 * the same cards without a different minimum spend: usually levels decided by
 * card number (BIN) or by card name, which the reviewer must split by card.
 * At most one note per page.
 */
export function tierNotes(promo: ParsedPromo, offers: Offer[]): string[] {
  const cardsOf = (o: Offer) => new Set(o.card_keys.length ? o.card_keys : promo.creditCards.map((c) => c.key));
  const merchantsOf = (o: Offer) => o.merchant_names.map((n) => n.trim().toLowerCase()).sort().join("|");
  const involved = new Set<string>();
  for (let i = 0; i < offers.length; i++) {
    for (let j = i + 1; j < offers.length; j++) {
      const a = offers[i];
      const b = offers[j];
      if (!merchantsOf(a) || merchantsOf(a) !== merchantsOf(b)) continue;
      if (a.benefit_type !== b.benefit_type || a.minimum_spend_vnd !== b.minimum_spend_vnd) continue;
      if (![...cardsOf(a)].some((k) => cardsOf(b).has(k))) continue;
      involved.add(a.title).add(b.title);
    }
  }
  if (!involved.size) return [];
  return [
    `${involved.size} ưu đãi cùng cửa hàng và cùng thẻ nhưng mức khác nhau (${[...involved].map((t) => `"${t}"`).join(", ")}): kiểm tra thẻ nào hưởng mức nào (theo tên thẻ hoặc 6 số đầu thẻ) và bỏ bớt thẻ ở từng ưu đãi.`,
  ];
}

/** Money offers without a VND amount or percentage (e.g. stated in USD) need a manual check. */
export function amountNotes(offers: Offer[]): string[] {
  return offers
    .filter((o) => (o.benefit_type === "cashback" || o.benefit_type === "discount") && o.percentage === null && o.fixed_amount_vnd === null)
    .map((o) => `"${o.title}": không có số tiền VND hay tỷ lệ (có thể ghi bằng ngoại tệ): ước tính tiết kiệm sẽ ở trạng thái thiếu thông tin.`);
}

export interface RunReport {
  bank: string;
  today: string;
  discovered: { promos: number; cards: number; blocked: number; unmatched: string[]; unmatchedTotal: number };
  warnings: string[];
  pages: PageReport[];
  parsed: ParsedPromo[];
  unknownCardSlugs: { slug: string; title: string; key: string }[];
  bundles: Bundles;
}

/** Error text including the underlying cause (HTTP status and code, timeout, network). */
export function describeError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cause = e.cause instanceof Error ? e.cause : null;
  if (!cause) return e.message;
  const reason = cause.name === "AbortError" ? "hết thời gian chờ (timeout)" : cause.message;
  return `${e.message}: ${reason}`;
}

/** Stop calling the model after this many consecutive failures in one run. */
const MAX_CONSECUTIVE_LLM_ERRORS = 3;

export async function runCrawl(o: RunOptions): Promise<RunReport> {
  const log = o.log ?? (() => {});
  const discovery = await o.bank.discover(o.fetcher);
  const blocked = (o.bank as { lastBlocked?: string[] }).lastBlocked?.length ?? 0;
  const warnings: string[] = [];
  const prevCount = o.state.lastPromoCount;
  if (discovery.promos.length === 0) warnings.push("Không tìm thấy URL ưu đãi nào: có thể ngân hàng đã đổi cấu trúc sitemap/URL.");
  else if (prevCount && discovery.promos.length < prevCount * 0.5) {
    warnings.push(`Số URL ưu đãi giảm mạnh: ${prevCount} → ${discovery.promos.length}. Kiểm tra lại cấu hình.`);
  }
  const seenUnmatched = new Set(o.state.seenUnmatched ?? []);
  const newUnmatched = discovery.unmatched.filter((u) => !seenUnmatched.has(u));
  o.state.seenUnmatched = [...discovery.unmatched].sort();
  if (newUnmatched.length) {
    warnings.push(`${newUnmatched.length} URL mới giống ưu đãi nhưng không khớp mẫu nào (xem danh sách).`);
  }
  log(`Discovered ${discovery.promos.length} promotions, ${discovery.cards.length} card pages, ${blocked} skipped by slug.`);

  const cardPageBySlug = new Map(discovery.cards.map((c) => [c.url.split("/").pop()!, c.url]));
  const pages: PageReport[] = [];
  const parsedAll: ParsedPromo[] = [];
  const results: { promo: ParsedPromo; offers: Offer[] }[] = [];
  const unknownCards = new Map<string, { slug: string; title: string; key: string }>();
  let fetched = 0;
  let consecutiveEmpty = 0;
  let consecutiveLlmErrors = 0;
  // Identical content published under several URLs is extracted once.
  const hashIndex = new Map<string, string>();
  for (const [u, p] of Object.entries(o.state.pages)) {
    if (p.hash && ["extracted", "needs_manual", "no_offers"].includes(p.outcome) && !hashIndex.has(p.hash)) hashIndex.set(p.hash, u);
  }
  let llmStopped: string | null = null;

  for (const { url } of discovery.promos) {
    const prior = o.state.pages[url];
    if (!o.force && prior?.expiryDate && prior.expiryDate < o.today) continue; // expired stays expired
    if (o.limit !== undefined && fetched >= o.limit) break;
    fetched++;

    const now = o.retrievedAt;
    const mark = (outcome: PageOutcome, hash: string | null, expiryDate: string | null) => {
      o.state.pages[url] = { hash, outcome, firstSeen: prior?.firstSeen ?? now, lastChecked: now, expiryDate };
    };

    let html: string;
    try {
      const res = await o.fetcher(url);
      if (res.status !== 200) {
        mark("error", prior?.hash ?? null, prior?.expiryDate ?? null);
        pages.push({ url, outcome: "error", detail: `HTTP ${res.status}` });
        continue;
      }
      html = res.text;
    } catch (e) {
      mark("error", prior?.hash ?? null, prior?.expiryDate ?? null);
      pages.push({ url, outcome: "error", detail: e instanceof RobotsDisallowedError ? "robots.txt không cho phép" : String(e) });
      continue;
    }

    const promo = o.bank.parse(url, html);
    if (!promo) {
      mark("unparseable", null, null);
      pages.push({ url, outcome: "unparseable", detail: "Không tìm thấy dữ liệu ưu đãi trong trang" });
      consecutiveEmpty++;
      continue;
    }
    consecutiveEmpty = 0;
    if (promo.expiryDate && promo.expiryDate < o.today) {
      mark("expired", promo.contentHash, promo.expiryDate);
      pages.push({ url, outcome: "expired", title: promo.title, detail: `Hết hạn ${promo.expiryDate}` });
      continue;
    }
    if (!promo.isCreditCard) {
      mark("not_credit_card", promo.contentHash, promo.expiryDate);
      pages.push({ url, outcome: "not_credit_card", title: promo.title });
      continue;
    }
    for (const c of promo.creditCards) {
      // Some card pages use the bank's key unchanged as their slug (e.g. "the-tin-dung-techcombank-visa-classic").
      if (!cardPageBySlug.has(c.slug) && cardPageBySlug.has(c.key)) c.slug = c.key;
      if (!cardPageBySlug.has(c.slug)) unknownCards.set(c.slug, c);
    }
    parsedAll.push(promo);

    if (!o.force && prior?.hash === promo.contentHash && prior.outcome !== "error") {
      pages.push({ url, outcome: "unchanged", title: promo.title });
      continue;
    }
    const original = hashIndex.get(promo.contentHash);
    if (original && original !== url) {
      mark("duplicate", promo.contentHash, promo.expiryDate);
      pages.push({ url, outcome: "duplicate", title: promo.title, detail: `Trùng nội dung với ${original}` });
      continue;
    }
    if (!o.caller || llmStopped) {
      pages.push({ url, outcome: "parsed", title: promo.title });
      continue; // state not updated, so the page is extracted on the next LLM run
    }

    try {
      log(`Extracting ${url}`);
      const extraction = await extractOffers(o.caller, promo, {
        today: o.today,
        categorySlugs: o.categories.map((c) => c.slug),
        categories: o.categories,
      });
      hashIndex.set(promo.contentHash, url);
      const outcome: PageOutcome = extraction.accepted.length
        ? "extracted"
        : extraction.rejected.length
          ? "needs_manual"
          : "no_offers";
      consecutiveLlmErrors = 0;
      mark(outcome, promo.contentHash, promo.expiryDate);
      const reviewNotes = [...tierNotes(promo, extraction.accepted), ...amountNotes(extraction.accepted)];
      pages.push({ url, outcome, title: promo.title, extraction, ...(reviewNotes.length ? { reviewNotes } : {}) });
      if (extraction.accepted.length) results.push({ promo, offers: extraction.accepted });
    } catch (e) {
      const reason = describeError(e);
      mark("error", null, promo.expiryDate);
      pages.push({ url, outcome: "error", title: promo.title, detail: `LLM: ${reason}` });
      if (++consecutiveLlmErrors >= MAX_CONSECUTIVE_LLM_ERRORS || isQuotaError(reason) || /HTTP 401/.test(reason)) {
        llmStopped = reason;
        warnings.push(`Đã ngừng gọi AI sau lỗi: ${reason}. Các trang còn lại chỉ được phân tích, sẽ trích xuất ở lần chạy sau.`);
        log(`Stopping LLM calls: ${reason}`);
      }
    }
  }

  if (fetched >= 5 && consecutiveEmpty >= 5) {
    warnings.push("Nhiều trang liên tiếp không có dữ liệu ưu đãi: có thể trang đã đổi giao diện (data-cf).");
  }
  o.state.lastPromoCount = discovery.promos.length;

  const bundles = buildBundles({
    bank: o.bank,
    results,
    retrievedAt: o.retrievedAt,
    knownMerchants: o.knownMerchants,
    cardPageBySlug,
  });

  return {
    bank: o.bank.slug,
    today: o.today,
    discovered: {
      promos: discovery.promos.length,
      cards: discovery.cards.length,
      blocked,
      unmatched: newUnmatched,
      unmatchedTotal: discovery.unmatched.length,
    },
    warnings,
    pages,
    parsed: parsedAll,
    unknownCardSlugs: [...unknownCards.values()],
    bundles,
  };
}

export function renderReport(r: RunReport): string {
  const count = (k: PageReport["outcome"]) => r.pages.filter((p) => p.outcome === k).length;
  const lines: string[] = [];
  lines.push(`# Crawl ${r.bank} — ${r.today}`, "");
  lines.push(`- URL ưu đãi trong sitemap: ${r.discovered.promos} (bỏ qua theo slug: ${r.discovered.blocked})`);
  lines.push(`- Trang thẻ trong sitemap: ${r.discovered.cards}`);
  lines.push(
    `- Đã kiểm tra: ${r.pages.length} — trích xuất ${count("extracted")}, cần nhập tay ${count("needs_manual")}, không có ưu đãi thẻ ${count("no_offers")}, ` +
      `không phải thẻ tín dụng ${count("not_credit_card")}, hết hạn ${count("expired")}, không đổi ${count("unchanged")}, ` +
      `trùng lặp ${count("duplicate")}, chỉ phân tích ${count("parsed")}, không đọc được ${count("unparseable")}, lỗi ${count("error")}`,
  );
  lines.push(`- Ưu đãi nháp trong bundle: ${r.bundles.main.deals.length} (nguồn: ${r.bundles.main.sources.length})`);
  lines.push(`- Thẻ/cửa hàng tạm (stubs): ${r.bundles.stubs.cards.length} thẻ, ${r.bundles.stubs.merchants.length} cửa hàng`, "");

  if (r.warnings.length) lines.push("## Cảnh báo", ...r.warnings.map((w) => `- ⚠️ ${w}`), "");
  if (r.unknownCardSlugs.length) {
    lines.push("## Thẻ không khớp trang thẻ nào", "Thêm vào `CARD_KEY_ALIASES` nếu slug thẻ khác với trang thẻ:", "");
    for (const c of r.unknownCardSlugs) lines.push(`- \`${c.key}\` → \`${c.slug}\` (${c.title})`);
    lines.push("");
  }
  const review = r.pages.filter((p) => p.reviewNotes?.length);
  if (review.length) {
    lines.push("## Cần chú ý khi duyệt", "");
    for (const p of review) lines.push(`### ${p.title ?? p.url}`, p.url, ...p.reviewNotes!.map((n) => `- ${n}`), "");
  }
  const skipped = r.pages.filter((p) => p.extraction?.skipped.length);
  if (skipped.length) {
    lines.push("## Ưu đãi bị bỏ qua", "");
    for (const p of skipped) for (const s of p.extraction!.skipped) lines.push(`- ${s.offer.title} — ${s.reason} (${p.url})`);
    lines.push("");
  }
  const duplicates = r.pages.filter((p) => p.outcome === "duplicate");
  if (duplicates.length) lines.push("## Trang trùng nội dung", ...duplicates.map((p) => `- ${p.url}: ${p.detail}`), "");
  const manual = r.pages.filter((p) => p.extraction?.rejected.length);
  if (manual.length) {
    lines.push("## Ưu đãi cần nhập tay (không qua kiểm tra)", "");
    for (const p of manual) {
      lines.push(`### ${p.title ?? p.url}`, p.url);
      for (const rej of p.extraction!.rejected) {
        const title = (rej.offer as { title?: string } | null)?.title ?? "(không có tiêu đề)";
        lines.push(`- ${title}: ${rej.problems.join("; ")}`);
      }
      lines.push("");
    }
  }
  if (r.bundles.invalid.length) {
    lines.push("## Ưu đãi không hợp lệ theo schema import", ...r.bundles.invalid.map((i) => `- ${i.importKey}: ${i.problems.join("; ")}`), "");
  }
  const errors = r.pages.filter((p) => p.outcome === "error" || p.outcome === "unparseable");
  if (errors.length) lines.push("## Lỗi", ...errors.map((p) => `- ${p.url}: ${p.detail ?? p.outcome}`), "");
  if (r.discovered.unmatched.length) {
    const bySection = new Map<string, string[]>();
    for (const u of r.discovered.unmatched) {
      const parts = new URL(u).pathname.split("/").filter(Boolean);
      const section = `/${parts.slice(0, Math.min(2, parts.length - 1)).join("/")}/`;
      bySection.set(section, [...(bySection.get(section) ?? []), u]);
    }
    lines.push(
      `## URL mới giống ưu đãi nhưng không khớp mẫu (${r.discovered.unmatched.length} mới / ${r.discovered.unmatchedTotal} tổng)`,
      "Chỉ liệt kê URL chưa thấy ở lần chạy trước.",
      "",
    );
    for (const [section, urls] of [...bySection].sort((a, b) => b[1].length - a[1].length)) {
      lines.push(`### ${section} (${urls.length})`, ...urls.map((u) => `- ${u}`), "");
    }
  }
  return lines.join("\n");
}
