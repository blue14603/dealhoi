import { expect, test } from "@playwright/test";
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from "./env";

test.describe("Journey B — card-first discovery", () => {
  test("browse a card, view verified benefits and complete the compatibility quiz", async ({ page }) => {
    await page.goto("/the-tin-dung");
    await expect(page.getByText("Biển Xanh Premium")).toHaveCount(0); // draft card hidden
    await page.getByRole("link", { name: /Hoa Sen Travel Signature/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hoa Sen Travel Signature");
    await expect(page.getByText("1.999.000 ₫").first()).toBeVisible();
    const highlights = page.locator("section[aria-labelledby='h-highlights'] article");
    expect(await highlights.count()).toBeLessThanOrEqual(3);
    expect(await highlights.count()).toBeGreaterThan(0);

    await page.getByRole("link", { name: "Thẻ này có phù hợp với bạn không?" }).first().click();
    await expect(page).toHaveURL(/phu-hop/);
    await page.getByRole("button", { name: /Xem mức độ phù hợp/ }).click();
    await expect(page.getByText("Vui lòng hoàn thành các câu hỏi được đánh dấu.")).toBeVisible();

    await page.getByLabel("20 – 50 triệu ₫").check();
    await page.getByLabel("Du lịch & hàng không", { exact: true }).check();
    await page.getByLabel("Mua sắm trực tuyến", { exact: true }).check();
    await page.getByLabel("Đặc quyền du lịch").check();
    await page.getByLabel("Tối đa 500.000 ₫/năm").check();
    await page.getByLabel("Tôi sẽ thanh toán toàn bộ dư nợ mỗi tháng").check();
    await page.getByRole("button", { name: /Xem mức độ phù hợp/ }).click();

    const result = page.getByTestId("compatibility-result");
    await expect(result).toBeVisible();
    await expect(result.getByText("Mức độ khớp danh mục chi tiêu")).toBeVisible();
    await expect(result.getByText("Hạn chế & bất lợi")).toBeVisible();
    await expect(result.getByText(/không phải đánh giá khả năng tín dụng/)).toBeVisible();
    await expect(result.getByText("Lưu ý về dư nợ thẻ tín dụng")).toHaveCount(0);
    // 1 of 2 categories → category score 50
    await expect(result.getByText("1/2 danh mục bạn chọn có quyền lợi đã xác minh.")).toBeVisible();

    // Answers persist in local storage.
    await page.reload();
    await expect(page.getByLabel("Du lịch & hàng không", { exact: true })).toBeChecked();
  });

  test("unknown annual fee yields a provisional score, not a perfect match", async ({ page }) => {
    await page.goto("/the-tin-dung/bien-xanh-everyday-world/phu-hop");
    await page.getByLabel("5 – 10 triệu ₫").check();
    await page.getByLabel("Cà phê & đồ uống", { exact: true }).check();
    await page.getByLabel("Hoàn tiền").check();
    await page.getByLabel("Chỉ thẻ miễn phí thường niên").check();
    await page.getByLabel("Tôi chưa chắc chắn").check();
    await page.getByRole("button", { name: /Xem mức độ phù hợp/ }).click();
    const result = page.getByTestId("compatibility-result");
    await expect(result.getByText("Điểm tạm tính", { exact: true })).toBeVisible();
    await expect(result.getByText("Lưu ý về dư nợ thẻ tín dụng")).toBeVisible();
  });
});

test.describe("Admin", () => {
  test("requires authentication and allows a verified admin to review data", async ({ page }) => {
    await page.goto("/admin/deals");
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.getByLabel("Email").fill(E2E_ADMIN_EMAIL);
    await page.getByLabel("Mật khẩu").fill("wrong-password");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page.getByText(/không đúng/)).toBeVisible();
    await page.getByLabel("Mật khẩu").fill(E2E_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page.getByRole("heading", { name: "Tổng quan dữ liệu" })).toBeVisible();

    await page.goto("/admin/import");
    await page.getByLabel("Nội dung").fill(JSON.stringify({ deals: [{ import_key: "e2e-1", title: "E2E", description: "x", category_slug: "ca-phe", benefit_type: "cashback", offer_type: "ongoing", merchant_scope: "category_wide", percentage: 120 }] }));
    await page.getByRole("button", { name: /Kiểm tra/ }).click();
    await expect(page.getByText(/lỗi cần sửa/)).toBeVisible();
  });
});
