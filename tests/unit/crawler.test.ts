import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { classifyUrls, parsePromotionPage, parseVnDate, techcombank } from "../../crawler/banks/techcombank";
import { importKey, normalizeOffer } from "../../crawler/core/bundle";
import { extractOffers, quoteFound, validateOffer, type Offer } from "../../crawler/core/extract";
import { decodeEntities, htmlToText } from "../../crawler/core/html";
import { AiUnavailableError, createStructuredCaller } from "@/lib/ai/openai-client";
import { createPoliteFetcher, RobotsDisallowedError } from "../../crawler/core/http";
import { parseRobots } from "../../crawler/core/robots";
import { amountNotes, renderReport, runCrawl, tierNotes } from "../../crawler/core/run";
import { buildBundles } from "../../crawler/core/bundle";
import { resolveMerchant } from "../../crawler/core/merchants";
import { parseSitemap } from "../../crawler/core/sitemap";
import type { CrawlState } from "../../crawler/core/state";
import type { Fetcher } from "../../crawler/core/types";

const SHOPEE_URL =
  "https://techcombank.com/khach-hang-ca-nhan/uu-dai/uu-dai-len-den-700k-khi-thanh-toan-bang-the-tin-dung-the-thanh-toan-techcombank-tai-shopee";
const shopeeHtml = readFileSync("tests/fixtures/crawler/tcb-shopee.html", "utf8");
const CATEGORIES = ["ca-phe", "mua-sam-truc-tuyen", "dien-tu-cong-nghe", "du-lich-hang-khong", "giai-tri-su-kien", "chi-tieu-chung"];
const CATEGORY_INFO = CATEGORIES.map((slug) => ({ slug, name: slug }));

const TCB_ROBOTS = `Sitemap: https://techcombank.com/sitemap-index.xml

User-agent: *
Disallow: /ve-chung-toi/phap-ly-va-tuan-thu/*
Disallow: /thong-tin/archive/*
Disallow: /mang-luoi-dia-diem-atm/*
Disallow: /en/en/*

Allow: /.well-known/
User-Agent:Googlebot
User-Agent:Googlebot-Mobile
`;

function offer(over: Partial<Offer> = {}): Offer {
  return {
    title: "Tặng 500.000 đồng khi trả góp từ 15 triệu tại Shopee",
    description: "Trả góp bằng thẻ tín dụng Techcombank tại Shopee",
    applies_to: "credit_only",
    is_targeted: false,
    card_keys: [],
    benefit_type: "discount",
    offer_type: "temporary",
    percentage: null,
    fixed_amount_vnd: 500000,
    maximum_benefit_vnd: null,
    cap_period: null,
    cap_is_unlimited: null,
    minimum_spend_vnd: 15000000,
    minimum_spend_period: "transaction",
    installment_months: null,
    installment_fee_vnd: null,
    payment_channel: "online",
    merchant_scope: "specific_merchant",
    merchant_names: ["Shopee"],
    category_slug: "mua-sam-truc-tuyen",
    start_date: "2026-01-21",
    end_date: "2026-04-30",
    eligibility_terms: null,
    terms_and_conditions: "Chỉ áp dụng vào các ngày 21/1, 22/1, 23/1, 8/4, 9/4, 10/4/2026",
    evidence: "Tặng 500.000 đồng cho giao dịch từ 15 triệu, 700K cho giao dịch từ 30 triệu áp dụng cho các dịp",
    ...over,
  };
}

describe("robots.txt", () => {
  const robots = parseRobots(TCB_ROBOTS, "DealHoiCrawler/0.1");
  it("allows promotion and card pages", () => {
    expect(robots.isAllowed(SHOPEE_URL)).toBe(true);
    expect(robots.isAllowed("https://techcombank.com/khach-hang-ca-nhan/chi-tieu/the/the-tin-dung/techcombank-spark")).toBe(true);
  });
  it("blocks disallowed paths", () => {
    expect(robots.isAllowed("https://techcombank.com/ve-chung-toi/phap-ly-va-tuan-thu/abc.pdf")).toBe(false);
    expect(robots.isAllowed("https://techcombank.com/en/en/anything")).toBe(false);
  });
  it("reads sitemaps", () => expect(robots.sitemaps).toEqual(["https://techcombank.com/sitemap-index.xml"]));
  it("handles $ anchors and longest match", () => {
    const r = parseRobots("User-agent: *\nDisallow: /*.jsp$\nDisallow: /a\nAllow: /a/b", "x");
    expect(r.isAllowed("https://x.vn/page.jsp")).toBe(false);
    expect(r.isAllowed("https://x.vn/page.jsp?x=1")).toBe(true);
    expect(r.isAllowed("https://x.vn/a/c")).toBe(false);
    expect(r.isAllowed("https://x.vn/a/b/c")).toBe(true);
  });
});

describe("polite fetcher", () => {
  it("refuses URLs disallowed by robots.txt", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      new Response(String(url).endsWith("/robots.txt") ? TCB_ROBOTS : "ok", { status: 200 }),
    ) as unknown as typeof fetch;
    const f = createPoliteFetcher({ fetchImpl, sleep: async () => {}, delayMs: 0 });
    await expect(f("https://techcombank.com/thong-tin/archive/old")).rejects.toBeInstanceOf(RobotsDisallowedError);
    await expect(f(SHOPEE_URL)).resolves.toEqual({ status: 200, text: "ok" });
  });
});

describe("sitemap", () => {
  it("parses an index and a urlset", () => {
    const idx = parseSitemap(`<sitemapindex><sitemap><loc>https://techcombank.com/vn.sitemap.vi-sitemap.xml</loc></sitemap></sitemapindex>`);
    expect(idx).toEqual({ kind: "index", entries: [{ url: "https://techcombank.com/vn.sitemap.vi-sitemap.xml", lastmod: null }] });
    const set = parseSitemap(`<urlset><url><loc>${SHOPEE_URL}</loc><lastmod>2026-07-11T16:56:42.469Z</lastmod></url></urlset>`);
    expect(set.entries[0]).toEqual({ url: SHOPEE_URL, lastmod: "2026-07-11T16:56:42.469Z" });
  });
});

describe("Techcombank URL classification", () => {
  const base = "https://techcombank.com/khach-hang-ca-nhan";
  const r = classifyUrls(
    [
      `${base}/chi-tieu/the/the-tin-dung`,
      `${base}/chi-tieu/the/the-tin-dung/techcombank-spark`,
      `${base}/chi-tieu/the/the-tin-dung/tra-gop`,
      `${base}/uu-dai`,
      SHOPEE_URL,
      `${base}/uu-dai/uu-dai-chuyen-doi-tra-gop-cho-chu-the-tin-dung-techcombank-tai-FPT-shop`,
      `${base}/uu-dai/khuyen-mai-dac-quyen-danh-cho-khach-hang-tham-gia-bao-hiem-thong-qua-techcombank`,
      `${base}/chi-tieu/the/khuyen-mai/chi-tieu-cung-the-thanh-toan-techcombank-hoan-den-1500000-vnd`,
      `${base}/khuyen-mai-moi/abc`,
      `${base}/tiet-kiem/chuong-trinh-uu-dai`,
      "https://techcombank.com/thong-tin/blog/uu-dai-the-tin-dung",
      "https://techcombank.com/khach-hang-doanh-nghiep/uu-dai-tet-danh-cho-doanh-nghiep",
      "https://techcombank.com/thong-tin/thong-bao/uu-dai-starbucks-voi-the-techcombank-visa",
    ].map((url) => ({ url, lastmod: null })),
  );
  it("finds card pages and skips feature pages", () => {
    expect(r.cards.map((c) => c.url)).toEqual([`${base}/chi-tieu/the/the-tin-dung/techcombank-spark`]);
  });
  it("finds promotions in both sections, including uppercase slugs", () => {
    expect(r.promos.map((p) => p.url)).toEqual([
      SHOPEE_URL,
      `${base}/uu-dai/uu-dai-chuyen-doi-tra-gop-cho-chu-the-tin-dung-techcombank-tai-FPT-shop`,
      `${base}/chi-tieu/the/khuyen-mai/chi-tieu-cung-the-thanh-toan-techcombank-hoan-den-1500000-vnd`,
    ]);
  });
  it("skips blocklisted slugs and reports unmatched promotion-like URLs", () => {
    expect(r.blocked).toHaveLength(1);
    // Business, savings and blog sections are ignored; announcements are still reported.
    expect(r.unmatched).toEqual([
      `${base}/khuyen-mai-moi/abc`,
      "https://techcombank.com/thong-tin/thong-bao/uu-dai-starbucks-voi-the-techcombank-visa",
    ]);
  });
});

describe("Techcombank page parsing", () => {
  const promo = parsePromotionPage(SHOPEE_URL, shopeeHtml)!;
  it("reads the embedded data-cf JSON", () => {
    expect(promo.title).toBe("Ưu đãi lên đến 700K khi thanh toán bằng thẻ tín dụng/Thẻ thanh toán Techcombank tại Shopee");
    expect(promo.expiryDate).toBe("2026-04-30");
    expect(promo.isCreditCard).toBe(true);
    expect(promo.merchants).toEqual([{ key: "shopee", title: "Shopee" }]);
    expect(promo.categoryHints).toContain("Sàn TMĐT");
  });
  it("maps credit cards to slugs", () => {
    expect(promo.creditCards.map((c) => c.slug)).toEqual([
      "techcombank-priority-visa-signature",
      "techcombank-visa-signature",
      "techcombank-private-visa-infinite",
      "techcombank-visa-classic",
      "vietnam-airlines-techcombank-visa-platinum",
      "vietnam-airlines-techcombank-visa-gold",
    ]);
  });
  it("converts the offer HTML to plain text", () => {
    expect(promo.text).toContain("Tặng 500.000 đồng cho giao dịch từ 15 triệu, 700K cho giao dịch từ 30 triệu");
    expect(promo.text).toContain("Thời gian: 21/01/2026 đến hết ngày 30/4/2026");
    expect(promo.text).not.toMatch(/<[a-z]/i);
  });
  it("collects T&C documents as absolute URLs", () => {
    expect(promo.documents.map((d) => d.url)).toEqual([
      "https://techcombank.com/content/dam/techcombank/public-site/promo_file/vi-tnc-usage-shopee-21012026.pdf",
      "https://techcombank.com/content/dam/techcombank/public-site/promo_file/vi-tnc-installment-shopee-21012026.pdf",
    ]);
  });
  it("hashes content deterministically", () => {
    expect(parsePromotionPage(SHOPEE_URL, shopeeHtml)!.contentHash).toBe(promo.contentHash);
    const changed = shopeeHtml.replace("Tặng 500.000 đồng", "Tặng 600.000 đồng");
    expect(parsePromotionPage(SHOPEE_URL, changed)!.contentHash).not.toBe(promo.contentHash);
  });
  it("returns null for pages without promotion data", () => {
    expect(parsePromotionPage(SHOPEE_URL, "<html><body>Không có</body></html>")).toBeNull();
  });
  it("helpers", () => {
    expect(parseVnDate("30/4/2026 23:59:00")).toBe("2026-04-30");
    expect(decodeEntities("a&#34;b&amp;c&#x41;")).toBe('a"b&cA');
    expect(htmlToText("<ul><li>A&nbsp;B</li><li>C</li></ul>")).toBe("- A B\n- C");
  });
});

describe("offer validation", () => {
  const promo = parsePromotionPage(SHOPEE_URL, shopeeHtml)!;
  const ctx = { promo, today: "2026-03-01" };
  it("accepts an offer whose figures, dates and quote are on the page", () => {
    expect(validateOffer(offer(), ctx)).toEqual([]);
  });
  it("rejects figures that are not on the page", () => {
    expect(validateOffer(offer({ fixed_amount_vnd: 600000 }), ctx)).toContain("fixed_amount_vnd 600000 không có trong trang");
    expect(validateOffer(offer({ percentage: 15 }), ctx)).toContain("percentage 15% không có trong trang");
  });
  it("rejects invented quotes, cards, merchants and dates", () => {
    const problems = validateOffer(
      offer({ evidence: "Hoàn 20% không giới hạn", card_keys: ["the-tin-dung-khong-ton-tai"], merchant_names: ["Lazada"], start_date: "2026-02-01" }),
      ctx,
    );
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("evidence không trích nguyên văn từ trang"),
        "card_keys không có trong danh sách thẻ: the-tin-dung-khong-ton-tai",
        "cửa hàng không có trong trang: Lazada",
        "start_date 2026-02-01 không có trong trang",
      ]),
    );
  });
});

describe("extraction", () => {
  const promo = parsePromotionPage(SHOPEE_URL, shopeeHtml)!;
  it("skips debit-only offers and retries once on validation failure", async () => {
    const debit = offer({ applies_to: "debit_only", percentage: 10, fixed_amount_vnd: null, maximum_benefit_vnd: 500000, minimum_spend_vnd: 3000000 });
    const caller = vi
      .fn()
      .mockResolvedValueOnce({ offers: [offer({ fixed_amount_vnd: 550000 }), debit], notes: null })
      .mockResolvedValueOnce({ offers: [offer(), debit], notes: null });
    const r = await extractOffers(caller, promo, { today: "2026-03-01", categorySlugs: CATEGORIES });
    expect(caller).toHaveBeenCalledTimes(2);
    expect(r.accepted).toHaveLength(1);
    expect(r.skipped).toHaveLength(1);
    expect(r.rejected).toHaveLength(0);
    const retry = caller.mock.calls[1][0].messages.at(-1).content as string;
    expect(retry).toContain("fixed_amount_vnd 550000");
  });
  it("returns offers that still fail as rejected for manual entry", async () => {
    const caller = vi.fn().mockResolvedValue({ offers: [offer({ fixed_amount_vnd: 550000 })], notes: null });
    const r = await extractOffers(caller, promo, { today: "2026-03-01", categorySlugs: CATEGORIES });
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].problems).toContain("fixed_amount_vnd 550000 không có trong trang");
  });
});

describe("full run", () => {
  const index = `<sitemapindex>
    <sitemap><loc>https://techcombank.com/vn.sitemap.en-sitemap.xml</loc></sitemap>
    <sitemap><loc>https://techcombank.com/vn.sitemap.vi-sitemap.xml</loc></sitemap>
  </sitemapindex>`;
  const urlset = `<urlset>
    <url><loc>https://techcombank.com/khach-hang-ca-nhan/chi-tieu/the/the-tin-dung/techcombank-visa-signature</loc></url>
    <url><loc>https://techcombank.com/khach-hang-ca-nhan/chi-tieu/the/the-tin-dung/the-tin-dung-techcombank-visa-classic</loc></url>
    <url><loc>${SHOPEE_URL}</loc></url>
    <url><loc>https://techcombank.com/khach-hang-ca-nhan/uu-dai/tang-voucher-uu-dai-khi-chi-tieu-voi-the-vietnam-airlines</loc></url>
  </urlset>`;
  const pages: Record<string, string> = {
    "https://techcombank.com/sitemap-index.xml": index,
    "https://techcombank.com/vn.sitemap.vi-sitemap.xml": urlset,
    [SHOPEE_URL]: shopeeHtml,
    "https://techcombank.com/khach-hang-ca-nhan/uu-dai/tang-voucher-uu-dai-khi-chi-tieu-voi-the-vietnam-airlines": "<html>changed layout</html>",
  };
  const fetcher: Fetcher = vi.fn(async (url: string) => (pages[url] ? { status: 200, text: pages[url] } : { status: 404, text: "" }));
  const base = {
    bank: techcombank,
    fetcher,
    retrievedAt: "2026-03-01T02:00:00.000Z",
    categories: CATEGORY_INFO,
    knownMerchants: [{ slug: "shopee", name: "Shopee" }],
  };

  it("extracts, builds draft bundles and skips unchanged pages next time", async () => {
    const state: CrawlState = { pages: {}, lastPromoCount: null };
    const caller = vi.fn().mockResolvedValue({
      offers: [
        offer(),
        offer({
          title: "Tặng 500.000 VNĐ cho đơn từ 10 triệu",
          benefit_type: "discount",
          minimum_spend_vnd: 10000000,
          card_keys: ["the-tin-dung-techcombank-visa-signature"],
          start_date: null,
          evidence: "Tặng 500.000 VNĐ để thanh toán cho đơn từ 10.000.000 VNĐ trở lên khi thanh toán qua Thẻ Tín dụng Techcombank",
        }),
      ],
      notes: null,
    });
    const r = await runCrawl({ ...base, caller, state, today: "2026-03-01" });

    expect(fetcher).not.toHaveBeenCalledWith("https://techcombank.com/vn.sitemap.en-sitemap.xml");
    expect(r.discovered).toMatchObject({ promos: 2, cards: 2 });
    expect(r.bundles.main.sources).toHaveLength(1);
    expect(r.bundles.main.deals).toHaveLength(2);
    // Offers are sorted deterministically (lower minimum spend first) so import keys stay stable.
    const [second, first] = r.bundles.main.deals;
    expect(second.import_key).toBe(importKey("techcombank", SHOPEE_URL, 0));
    expect(first.import_key).toBe(importKey("techcombank", SHOPEE_URL, 1));
    expect(first).toMatchObject({ merchant_slug: "shopee", publication_status: "draft", verification_status: "draft" });
    expect(first.cards).toHaveLength(6);
    expect(first.terms_and_conditions).toContain("vi-tnc-usage-shopee-21012026.pdf");
    expect(second.cards).toEqual([{ card_slug: "techcombank-visa-signature", additional_eligibility_terms: null }]);
    expect(second.end_date).toBe("2026-04-30");
    expect(r.bundles.stubs.merchants).toEqual([]);
    expect(r.bundles.stubs.cards.find((c) => c.slug === "techcombank-visa-signature")).toMatchObject({
      official_url: "https://techcombank.com/khach-hang-ca-nhan/chi-tieu/the/the-tin-dung/techcombank-visa-signature",
      network: "Visa",
    });
    expect(r.unknownCardSlugs.map((c) => c.slug)).not.toContain("techcombank-visa-signature");
    // A card page whose slug equals the bank's key is matched as-is.
    expect(first.cards.map((c) => c.card_slug)).toContain("the-tin-dung-techcombank-visa-classic");
    expect(r.unknownCardSlugs.map((c) => c.slug)).toContain("techcombank-private-visa-infinite");
    expect(r.pages.find((p) => p.outcome === "unparseable")).toBeTruthy();
    expect(renderReport(r)).toContain("Ưu đãi nháp trong bundle: 2");

    const again = await runCrawl({ ...base, caller, state, today: "2026-03-02" });
    expect(caller).toHaveBeenCalledTimes(1);
    expect(again.pages.find((p) => p.url === SHOPEE_URL)?.outcome).toBe("unchanged");
    expect(again.bundles.main.deals).toHaveLength(0);
  });

  it("marks expired promotions and does not refetch them", async () => {
    const state: CrawlState = { pages: {}, lastPromoCount: null };
    const caller = vi.fn();
    const r = await runCrawl({ ...base, caller, state, today: "2026-11-17" });
    expect(r.pages.find((p) => p.url === SHOPEE_URL)?.outcome).toBe("expired");
    expect(caller).not.toHaveBeenCalled();
    (fetcher as ReturnType<typeof vi.fn>).mockClear();
    await runCrawl({ ...base, caller, state, today: "2026-11-18" });
    expect(fetcher).not.toHaveBeenCalledWith(SHOPEE_URL);
  });

  it("parses without the LLM in --no-llm mode", async () => {
    const r = await runCrawl({ ...base, caller: null, state: { pages: {}, lastPromoCount: null }, today: "2026-03-01" });
    expect(r.pages.find((p) => p.url === SHOPEE_URL)?.outcome).toBe("parsed");
    expect(r.parsed).toHaveLength(1);
  });

  it("reports only unmatched URLs not seen in the previous run", async () => {
    const extra = "https://techcombank.com/lp/tong-hop-uu-dai-thanh-toan-qua-the-techcombank";
    const withExtra = urlset.replace("</urlset>", `<url><loc>${extra}</loc></url></urlset>`);
    const f: Fetcher = async (url) =>
      url.endsWith("vi-sitemap.xml") ? { status: 200, text: withExtra } : pages[url] ? { status: 200, text: pages[url] } : { status: 404, text: "" };
    const state: CrawlState = { pages: {}, lastPromoCount: null };
    const first = await runCrawl({ ...base, fetcher: f, caller: null, state, today: "2026-03-01", limit: 0 });
    expect(first.discovered.unmatched).toEqual([extra]);
    expect(renderReport(first)).toContain("### /lp/ (1)");
    const second = await runCrawl({ ...base, fetcher: f, caller: null, state, today: "2026-03-02", limit: 0 });
    expect(second.discovered).toMatchObject({ unmatched: [], unmatchedTotal: 1 });
    expect(second.warnings.join(" ")).not.toContain("không khớp mẫu");
  });

  it("maps known card key aliases", () => {
    const html = shopeeHtml.replace(
      "the-tin-dung-techcombank-visa-signature&#34;,&#34;path&#34;:&#34;techcombank:promotions/card-types/the-tin-dung/the-tin-dung-techcombank-visa-signature",
      "techcombank-visa-eco-card&#34;,&#34;path&#34;:&#34;techcombank:promotions/card-types/the-tin-dung/techcombank-visa-eco-card",
    );
    const slugs = parsePromotionPage(SHOPEE_URL, html)!.creditCards.map((c) => c.slug);
    expect(slugs).toContain("techcombank-visa-eco");
  });

  it("stops calling the model after repeated failures and keeps pages for the next run", async () => {
    const urls = ["a", "b", "c", "d"].map((x) => `https://techcombank.com/khach-hang-ca-nhan/uu-dai/promo-${x}`);
    const set = `<urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join("")}</urlset>`;
    const f: Fetcher = async (url) =>
      url.endsWith("sitemap-index.xml")
        ? { status: 200, text: index }
        : url.endsWith("vi-sitemap.xml")
          ? { status: 200, text: set }
          : { status: 200, text: shopeeHtml };
    const caller = vi.fn().mockRejectedValue(new AiUnavailableError("AI service unavailable after retries", new AiUnavailableError("OpenAI HTTP 429 (rate_limit_exceeded)")));
    const state: CrawlState = { pages: {}, lastPromoCount: null };
    const r = await runCrawl({ ...base, fetcher: f, caller, state, today: "2026-03-01" });
    expect(caller).toHaveBeenCalledTimes(3);
    expect(r.pages.filter((p) => p.outcome === "error")[0].detail).toBe(
      "LLM: AI service unavailable after retries: OpenAI HTTP 429 (rate_limit_exceeded)",
    );
    expect(r.pages.at(-1)?.outcome).toBe("parsed");
    expect(state.pages[urls[3]]).toBeUndefined();
    expect(r.warnings.join(" ")).toContain("Đã ngừng gọi AI");
  });

  it("stops at once when the OpenAI quota is exhausted", async () => {
    const caller = vi.fn().mockRejectedValue(new AiUnavailableError("OpenAI HTTP 429 (insufficient_quota)"));
    const r = await runCrawl({ ...base, caller, state: { pages: {}, lastPromoCount: null }, today: "2026-03-01" });
    expect(caller).toHaveBeenCalledTimes(1);
    expect(r.warnings.join(" ")).toContain("insufficient_quota");
  });

  it("warns when the number of promotions drops sharply", async () => {
    const r = await runCrawl({ ...base, caller: null, state: { pages: {}, lastPromoCount: 200 }, today: "2026-03-01" });
    expect(r.warnings.join(" ")).toContain("200 → 2");
  });
});

describe("OpenAI error details", () => {
  const call = (status: number, body: unknown) => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    const caller = createStructuredCaller({ apiKey: "k", model: "m", baseUrl: "http://x", timeoutMs: 1000, maxOutputTokens: 10, fetchImpl, sleep: async () => {} });
    return { fetchImpl, run: () => caller({ messages: [], schemaName: "s", jsonSchema: {} }) };
  };
  it("includes the error code and does not retry an exhausted quota", async () => {
    const { fetchImpl, run } = call(429, { error: { code: "insufficient_quota", type: "insufficient_quota" } });
    await expect(run()).rejects.toThrow("OpenAI HTTP 429 (insufficient_quota)");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("does not retry an exhausted credit balance (real OpenAI response)", async () => {
    const { fetchImpl, run } = call(429, {
      error: { message: "You have no credits remaining.", type: "insufficient_quota", param: null, code: "credit_balance_exhausted" },
    });
    await expect(run()).rejects.toThrow("OpenAI HTTP 429 (insufficient_quota, credit_balance_exhausted)");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("still retries rate limits", async () => {
    const { fetchImpl, run } = call(429, { error: { type: "requests", code: "rate_limit_exceeded" } });
    await expect(run()).rejects.toThrow("AI service unavailable after retries");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe("fixes from the first live run", () => {
  const promo = parsePromotionPage(SHOPEE_URL, shopeeHtml)!;

  it("never stores points as VND and drops a cap period without a cap", () => {
    const n = normalizeOffer(
      offer({ benefit_type: "points", fixed_amount_vnd: 150000, cap_period: "campaign", cap_is_unlimited: false, maximum_benefit_vnd: null }),
    );
    expect(n).toMatchObject({ fixed_amount_vnd: null, maximum_benefit_vnd: null, cap_period: null, cap_is_unlimited: null });
    const unlimited = normalizeOffer(offer({ percentage: 15, fixed_amount_vnd: null, cap_is_unlimited: true, maximum_benefit_vnd: 500000 }));
    expect(unlimited.maximum_benefit_vnd).toBeNull();
  });

  it("skips offers only for customers the bank contacted", async () => {
    const caller = vi.fn().mockResolvedValue({ offers: [offer({ is_targeted: true })], notes: null });
    const r = await extractOffers(caller, promo, { today: "2026-03-01", categorySlugs: CATEGORIES });
    expect(r.accepted).toHaveLength(0);
    expect(r.skipped[0].reason).toContain("được ngân hàng mời");
  });

  it("flags reward tiers that cover the same cards", () => {
    const a = offer({ title: "Giảm 12%", benefit_type: "discount", percentage: null, fixed_amount_vnd: 500000, minimum_spend_vnd: null });
    const b = offer({ title: "Giảm 10%", benefit_type: "discount", percentage: null, fixed_amount_vnd: 500000, minimum_spend_vnd: null });
    expect(tierNotes(promo, [a, b])[0]).toContain("cùng cửa hàng và cùng thẻ nhưng mức khác nhau");
    // Offers at different merchants are not flagged.
    expect(tierNotes(promo, [a, { ...b, merchant_names: ["Apple store Flagship"] }])).toEqual([]);
    // Several pairs on one page give a single note.
    expect(tierNotes(promo, [a, b, { ...b, title: "Giảm 8%" }])).toHaveLength(1);
    // Spend tiers (different minimum spend) are expected and not flagged.
    expect(tierNotes(promo, [offer(), offer({ minimum_spend_vnd: 30000000 })])).toEqual([]);
    // Disjoint card lists are not flagged.
    const c = offer({ card_keys: ["the-tin-dung-techcombank-visa-signature"], minimum_spend_vnd: null });
    const d = offer({ card_keys: ["the-tin-dung-techcombank-visa-classic"], minimum_spend_vnd: null });
    expect(tierNotes(promo, [c, d])).toEqual([]);
  });

  it("extracts identical pages published under two URLs only once", async () => {
    const urls = ["promo-a", "promo-a1"].map((x) => `https://techcombank.com/khach-hang-ca-nhan/uu-dai/${x}`);
    const set = `<urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join("")}</urlset>`;
    const index = `<sitemapindex><sitemap><loc>https://techcombank.com/vn.sitemap.vi-sitemap.xml</loc></sitemap></sitemapindex>`;
    const fetcher: Fetcher = async (url) =>
      url.endsWith("sitemap-index.xml")
        ? { status: 200, text: index }
        : url.endsWith("vi-sitemap.xml")
          ? { status: 200, text: set }
          : { status: 200, text: shopeeHtml };
    const caller = vi.fn().mockResolvedValue({ offers: [offer()], notes: null });
    const state: CrawlState = { pages: {}, lastPromoCount: null };
    const run = (today: string) =>
      runCrawl({
        bank: techcombank,
        fetcher,
        caller,
        state,
        today,
        retrievedAt: "2026-03-01T02:00:00.000Z",
        categories: CATEGORY_INFO,
        knownMerchants: [{ slug: "shopee", name: "Shopee" }],
      });
    const r = await run("2026-03-01");
    expect(caller).toHaveBeenCalledTimes(1);
    expect(r.pages.map((p) => p.outcome)).toEqual(["extracted", "duplicate"]);
    expect(r.bundles.main.deals).toHaveLength(1);
    expect(renderReport(r)).toContain("Trang trùng nội dung");
    const again = await run("2026-03-02");
    expect(caller).toHaveBeenCalledTimes(1);
    expect(again.pages.map((p) => p.outcome)).toEqual(["unchanged", "unchanged"]);
  });

  it("gives the model the category names", async () => {
    const caller = vi.fn().mockResolvedValue({ offers: [], notes: "none" });
    await extractOffers(caller, promo, {
      today: "2026-03-01",
      categorySlugs: CATEGORIES,
      categories: [{ slug: "mua-sam-truc-tuyen", name: "Mua sắm trực tuyến", aliases: ["shopee"] }],
    });
    const user = caller.mock.calls[0][0].messages[1].content as string;
    expect(user).toContain('"name":"Mua sắm trực tuyến"');
  });
});

describe("quote matching (China Airlines page from the live run)", () => {
  const page = `Giảm 15% khi mua vé máy bay tại China Airlines

## Nội dung ưu đãi
Thời gian: Từ ngày 01/07/2026 đến ngày 31/12/2026
Nội dung ưu đãi: Giảm 15% không giới hạn trên giá công bố tại ứng dụng điện thoại và website (không bao gồm thuế) (https://www.china-airlines.com/tw/en) cho tất cả các chuyến bay từ từ Tp.HCM/ Hà Nội/ Đà Nẵng đến Đài Bắc/Mĩ-Canada/Châu Âu/Châu Úc/Đông Nam Á khi mua vé tại ứng dụng điện thoại và website của China Airlines (https://www.china-airlines.com/tw/en).`;

  it("accepts quotes that drop links, brackets or punctuation", () => {
    expect(quoteFound(page, "Giảm 15% không giới hạn trên giá công bố tại ứng dụng điện thoại và website (không bao gồm thuế) cho tất cả các chuyến bay")).toBe(true);
    expect(quoteFound(page, "Giảm 15% không giới hạn trên giá công bố tại ứng dụng điện thoại và website không bao gồm thuế")).toBe(true);
  });
  it("accepts several real passages joined with an ellipsis", () => {
    expect(quoteFound(page, "Thời gian: Từ ngày 01/07/2026 đến ngày 31/12/2026 ... Giảm 15% không giới hạn trên giá công bố")).toBe(true);
  });
  it("rejects invented or altered quotes", () => {
    expect(quoteFound(page, "Giảm 20% không giới hạn trên giá công bố")).toBe(false);
    expect(quoteFound(page, "Thời gian: Từ ngày 01/07/2026 ... Hoàn tiền 500.000 VNĐ cho mọi giao dịch")).toBe(false);
    expect(quoteFound(page, "")).toBe(false);
  });
  it("moves in-store offers out of online shopping", () => {
    expect(normalizeOffer(offer({ payment_channel: "offline" })).category_slug).toBe("chi-tieu-chung");
    expect(normalizeOffer(offer({ payment_channel: "online" })).category_slug).toBe("mua-sam-truc-tuyen");
  });
});

describe("merchants from the page text (full run feedback)", () => {
  const promo = parsePromotionPage(SHOPEE_URL, shopeeHtml)!;
  const known = [
    { slug: "shopee", name: "Shopee" },
    { slug: "cellphones", name: "CellphoneS" },
    { slug: "the-gioi-di-dong", name: "Thế Giới Di Động", aliases: ["TGDĐ"] },
  ];
  const build = (offers: Offer[]) =>
    buildBundles({ bank: techcombank, results: [{ promo, offers }], retrievedAt: "2026-03-01T00:00:00Z", knownMerchants: known, cardPageBySlug: new Map() });

  it("matches merchant names to known merchants by name, alias or slug", () => {
    const r = (n: string) => resolveMerchant(n, known, [], (k) => k);
    expect(r("Thế giới di động")).toMatchObject({ slug: "the-gioi-di-dong", known: true });
    expect(r("TGDĐ")).toMatchObject({ slug: "the-gioi-di-dong", known: true });
    expect(r("Cellphones")).toMatchObject({ slug: "cellphones", known: true });
    expect(r("FPT Shop")).toEqual({ slug: "fpt-shop", name: "FPT Shop", known: false });
    expect(r("Điện Máy Xanh")).toMatchObject({ slug: "dien-may-xanh", known: false });
  });

  it("accepts merchant names written on the page and rejects others", () => {
    expect(validateOffer(offer({ merchant_names: ["Apple store Flagship"] }), { promo, today: "2026-03-01" })).toEqual([]);
    expect(validateOffer(offer({ merchant_names: ["Agoda"] }), { promo, today: "2026-03-01" })).toContain("cửa hàng không có trong trang: Agoda");
    expect(validateOffer(offer({ merchant_names: [] }), { promo, today: "2026-03-01" })).toContain(
      "ưu đãi riêng tại cửa hàng nhưng không xác định được cửa hàng",
    );
  });

  it("creates one deal per merchant with stable keys and stubs only new merchants", () => {
    const b = build([offer({ merchant_names: ["Shopee", "FPT Shop", "CellphoneS", "Shopee"] })]);
    expect(b.main.deals.map((d) => d.merchant_slug)).toEqual(["shopee", "fpt-shop", "cellphones"]);
    expect(b.main.deals.map((d) => d.import_key)).toEqual([
      `${importKey("techcombank", SHOPEE_URL, 0)}-shopee`,
      `${importKey("techcombank", SHOPEE_URL, 0)}-fpt-shop`,
      `${importKey("techcombank", SHOPEE_URL, 0)}-cellphones`,
    ]);
    expect(b.stubs.merchants).toEqual([{ slug: "fpt-shop", name: "FPT Shop", category_slug: "mua-sam-truc-tuyen", aliases: [] }]);
    // A single merchant keeps the plain key.
    expect(build([offer()]).main.deals[0].import_key).toBe(importKey("techcombank", SHOPEE_URL, 0));
  });

  it("keeps very long merchant lists as text on one category-wide deal", () => {
    const names = Array.from({ length: 9 }, (_, i) => `Cửa hàng ${i + 1}`);
    const [deal] = build([offer({ merchant_names: names })]).main.deals;
    expect(deal).toMatchObject({ merchant_slug: null, merchant_scope: "category_wide" });
    expect(deal.terms_and_conditions).toContain("Áp dụng tại: Cửa hàng 1");
  });

  it("flags money offers without a VND amount instead of rejecting them", () => {
    const usd = offer({ title: "Giảm 100 USD vé Singapore Airlines", fixed_amount_vnd: null, minimum_spend_vnd: null, merchant_names: ["Shopee"] });
    expect(validateOffer(usd, { promo, today: "2026-03-01" })).toEqual([]);
    expect(amountNotes([usd])[0]).toContain("không có số tiền VND");
    expect(amountNotes([offer()])).toEqual([]);
  });
});
