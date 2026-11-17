import { isQuotaError, type StructuredCaller } from "@/lib/ai/openai-client";
import { buildBundles, type Bundles } from "./bundle";
import { extractOffers, type ExtractionResult, type Offer } from "./extract";
import { RobotsDisallowedError } from "./http";
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
  categorySlugs: string[];
  knownMerchantSlugs: Set<string>;
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
    if (!o.caller || llmStopped) {
      pages.push({ url, outcome: "parsed", title: promo.title });
      continue; // state not updated, so the page is extracted on the next LLM run
    }

    try {
      log(`Extracting ${url}`);
      const extraction = await extractOffers(o.caller, promo, { today: o.today, categorySlugs: o.categorySlugs });
      const outcome: PageOutcome = extraction.accepted.length
        ? "extracted"
        : extraction.rejected.length
          ? "needs_manual"
          : "no_offers";
      consecutiveLlmErrors = 0;
      mark(outcome, promo.contentHash, promo.expiryDate);
      pages.push({ url, outcome, title: promo.title, extraction });
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
    knownMerchantSlugs: o.knownMerchantSlugs,
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
      `chỉ phân tích ${count("parsed")}, không đọc được ${count("unparseable")}, lỗi ${count("error")}`,
  );
  lines.push(`- Ưu đãi nháp trong bundle: ${r.bundles.main.deals.length} (nguồn: ${r.bundles.main.sources.length})`);
  lines.push(`- Thẻ/cửa hàng tạm (stubs): ${r.bundles.stubs.cards.length} thẻ, ${r.bundles.stubs.merchants.length} cửa hàng`, "");

  if (r.warnings.length) lines.push("## Cảnh báo", ...r.warnings.map((w) => `- ⚠️ ${w}`), "");
  if (r.unknownCardSlugs.length) {
    lines.push("## Thẻ không khớp trang thẻ nào", "Thêm vào `CARD_KEY_ALIASES` nếu slug thẻ khác với trang thẻ:", "");
    for (const c of r.unknownCardSlugs) lines.push(`- \`${c.key}\` → \`${c.slug}\` (${c.title})`);
    lines.push("");
  }
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
