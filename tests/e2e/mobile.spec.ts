import { expect, test } from "@playwright/test";

test("mobile comparison has no horizontal scroll and opens the chat sheet", async ({ page }) => {
  for (const path of ["/", "/so-sanh?merchant=starbucks&amount=150000", "/the-tin-dung/sao-mai-cashback-platinum", "/uu-dai"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await page.goto("/so-sanh?merchant=starbucks&amount=150000");
  await expect(page.getByTestId("comparison-card").first()).toBeVisible();
  await page.getByRole("button", { name: /Mở trợ lý/ }).click();
  await expect(page.getByRole("dialog", { name: "Hỏi DealHoi" })).toBeVisible();
});
