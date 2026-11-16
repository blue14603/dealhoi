import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  "/",
  "/so-sanh?merchant=starbucks&amount=150000",
  "/uu-dai",
  "/the-tin-dung",
  "/the-tin-dung/hoa-sen-travel-signature",
  "/the-tin-dung/sao-mai-cashback-platinum/phu-hop",
  "/tim-kiem?q=iphone",
  "/phuong-phap",
  "/admin/login",
];

for (const path of PAGES) {
  test(`no serious or critical WCAG 2.2 AA violations: ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
}
