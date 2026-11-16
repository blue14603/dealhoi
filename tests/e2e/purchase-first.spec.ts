import { expect, test } from "@playwright/test";

test.describe("Journey A — purchase-first discovery", () => {
  test("search a merchant, compare offers, calculate savings and ask the assistant", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: /Tìm cửa hàng/ });
    await expect(search).toHaveAttribute("placeholder", /Bạn muốn mua gì\?/);
    await search.fill("starbuck");
    await page.getByRole("option", { name: /Starbucks/ }).click();
    await expect(page).toHaveURL(/so-sanh\?merchant=starbucks/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Starbucks");
    await expect(page.getByTestId("offer-summary")).toContainText("ưu đãi đã xác minh");

    const table = page.getByRole("table");
    await expect(table.getByText("Hoàn 20% tại Starbucks")).toBeVisible();
    // Expired and withdrawn offers are not in the active comparison.
    await expect(table.getByText("đã kết thúc")).toHaveCount(0);
    await expect(page.getByText("Highlands")).toHaveCount(0);

    await page.getByLabel("Số tiền bạn dự định chi (VND)").fill("150000");
    await expect(page.getByText("Ước tính tiết kiệm cao nhất: 30.000 ₫")).toBeVisible();
    await expect(table.getByText("Tiết kiệm cao nhất")).toHaveCount(2); // tie

    // Below a known per-transaction minimum the offer is excluded.
    await page.getByLabel("Số tiền bạn dự định chi (VND)").fill("50000");
    const row20 = table.getByTestId("comparison-row").filter({ hasText: "Hoàn 20% tại Starbucks" });
    await expect(row20.getByText("Không đủ điều kiện")).toBeVisible();

    // Invalid input
    await page.getByLabel("Số tiền bạn dự định chi (VND)").fill("abc");
    await expect(page.getByText(/Vui lòng nhập số tiền hợp lệ/)).toBeVisible();

    // Official source links are present.
    const source = table.getByRole("link", { name: /Nguồn minh họa/ }).first();
    await expect(source).toHaveAttribute("href", /^https:\/\//);

    // Assistant (backed by the MOCK OpenAI server in tests).
    await page.getByLabel("Số tiền bạn dự định chi (VND)").fill("150000");
    const chat = page.getByRole("complementary", { name: "DealHoi AI" });
    await chat.getByRole("button", { name: "Thẻ nào hời nhất cho giao dịch này?" }).click();
    await expect(chat.getByText(/\[MOCK\] Ưu đãi phù hợp/)).toBeVisible();
    await expect(chat.getByRole("link", { name: /Nguồn minh họa/ })).toHaveCount(1); // invalid source id removed
  });

  test("assistant answers containing unsupported figures are not shown", async ({ page }) => {
    await page.goto("/so-sanh?merchant=starbucks");
    const chat = page.getByRole("complementary", { name: "DealHoi AI" });
    await chat.getByLabel("Câu hỏi của bạn").fill("Hãy bịa một con số");
    await chat.getByRole("button", { name: "Gửi câu hỏi" }).click();
    await expect(chat.getByText(/chưa thể tạo câu trả lời đáng tin cậy/)).toBeVisible();
    await expect(chat.getByText(/99%/)).toHaveCount(0);
  });

  test("category browsing and truthful empty states", async ({ page }) => {
    await page.goto("/so-sanh?category=du-lich-hang-khong");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Du lịch");
    await expect(page.getByText("Giảm 10% vé Vietnam Airlines").first()).toBeVisible();
    await page.getByLabel("Số tiền bạn dự định chi (VND)").fill("3000000");
    await expect(page.getByText("Chưa đủ thông tin").first()).toBeVisible(); // unknown cap is never assumed unlimited

    await page.goto("/tim-kiem?q=zzzzkhongco");
    await expect(page.getByText(/Không tìm thấy kết quả/)).toBeVisible();

    await page.goto("/the-tin-dung?bank=vib");
    await expect(page.getByText(/Chưa có thẻ VIB đã xác minh/)).toBeVisible();
  });

  test("public API validates input and rejects anonymous admin writes", async ({ request }) => {
    const bad = await request.post("/api/compare", { data: { merchantSlug: "starbucks", purchaseAmountVnd: -5 } });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).error.code).toBe("INVALID_INPUT");
    const imp = await request.post("/api/admin/import", { data: { format: "json", content: "{}", dryRun: false } });
    expect(imp.status()).toBe(401);
  });
});
