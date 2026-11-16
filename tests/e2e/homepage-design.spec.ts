import { expect, test } from "@playwright/test";

const CONCEPTS = [
  { key: "coffee", label: /Coffee Culture/i, headline: "Starbucks", href: "/so-sanh?merchant=starbucks" },
  { key: "tech", label: /Tech & Lifestyle/i, headline: "iPhone", href: "/so-sanh?merchant=apple" },
  { key: "shop", label: /Shop Smarter/i, headline: "Shopee", href: "/so-sanh?merchant=shopee" },
  { key: "travel", label: /Go Places/i, headline: "Vé máy bay", href: "/so-sanh?category=du-lich-hang-khong" },
];

const EMOJI = /\p{Extended_Pictographic}/u;

test.describe("Electric Chrome homepage", () => {
  test("editorial deal cards show verified data, artwork and link to the existing routes", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Chi thông minh.");
    for (const c of CONCEPTS) {
      const card = page.getByTestId(`discovery-${c.key}`);
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute("href", c.href);
      await expect(card.getByText(c.label)).toBeVisible();
      await expect(card.getByRole("heading", { name: c.headline })).toBeVisible();
      await expect(card.locator("img.ed-asset")).toHaveAttribute("src", /\/illustrations\/.+\.svg$/);
      await expect(card.getByText("Khám phá ưu đãi")).toBeVisible();
    }
    // Starbucks headline offer comes from the database (demo record: 20% cashback, cap 50.000 ₫).
    const coffee = page.getByTestId("discovery-coffee");
    await expect(coffee.getByText("20%", { exact: true })).toBeVisible();
    await expect(coffee.getByText("Tối đa 50.000 ₫ mỗi giao dịch")).toBeVisible();
    await coffee.click();
    await expect(page).toHaveURL(/so-sanh\?merchant=starbucks/);
  });

  test("no emoji are used anywhere on the homepage", async ({ page }) => {
    await page.goto("/");
    const text = await page.locator("body").innerText();
    expect(EMOJI.test(text)).toBe(false);
  });

  test("hover lifts the card and moves the asset; keyboard focus is visible", async ({ page }) => {
    await page.goto("/");
    const card = page.getByTestId("discovery-coffee");
    const asset = card.locator("img.ed-asset");
    const before = await asset.evaluate((el) => getComputedStyle(el).transform);
    await card.hover();
    await page.waitForTimeout(450);
    const cardTransform = await card.evaluate((el) => getComputedStyle(el).transform);
    const after = await asset.evaluate((el) => getComputedStyle(el).transform);
    expect(cardTransform).not.toBe("none");
    expect(after).not.toBe(before);
    const box = await card.boundingBox();
    expect(box?.height).toBeGreaterThan(250); // no layout collapse

    await page.mouse.move(0, 0);
    await card.focus();
    await page.waitForTimeout(350); // let the 200ms colour transition finish
    expect(await card.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
    const outline = await card.evaluate((el) => getComputedStyle(el).borderColor);
    expect(outline).toBe("rgb(169, 199, 255)"); // ice-blue focus border
  });

  test("reduced motion disables hover movement", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    await page.goto("/");
    const card = page.getByTestId("discovery-coffee");
    await card.hover();
    await page.waitForTimeout(100);
    expect(await card.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
    await ctx.close();
  });
});
