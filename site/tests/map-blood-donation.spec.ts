import { describePage, showsContent } from "./_shared";
import { test, expect } from "@playwright/test";

describePage("map/blood-donation", "/map/blood-donation/");

test("地図の献血から抽出した受付案内を読み、MAPへ戻れる", async ({ page }) => {
  test.skip(!showsContent("/map/"), "MAPが準備中のため");
  await page.goto("/map/");
  await page.getByRole("link", { name: "献血の案内を見る", exact: true }).click();
  await expect(page).toHaveURL(/\/map\/blood-donation\/$/);
  await expect(page.getByRole("heading", { name: "献血", exact: true })).toBeVisible();
  await expect(page.locator("main")).toContainText("10月31日（土）");
  await expect(page.locator("main")).toContainText("9:00〜11:30");
  await expect(page.locator("main")).toContainText("13:00〜15:00");
  await expect(page.locator("main")).toContainText("共同研究推進センター");
  await expect(page.getByRole("link", { name: "059-273-6702" })).toHaveAttribute("href", "tel:0592736702");
  await expect(page.getByRole("heading", { name: "献血前にお願いしたいこと" })).toBeVisible();
  await expect(page.locator("main")).toContainText("体重50kg未満の方");
  await expect(page.locator("main a[href$='.pdf']")).toHaveCount(0);
  await expect(page.locator(".reception")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".donation-content")).toHaveCSS("font-size", "16px");
  await page.getByRole("link", { name: "MAPに戻る", exact: false }).first().click();
  await expect(page).toHaveURL(/\/map\/$/);
});

test("スマホとPCで献血の建物を押して案内へ進める", async ({ page }) => {
  test.skip(!showsContent("/map/"), "MAPが準備中のため");
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/map/");
    const building = page.locator(".art-piece[data-node-id='1531:3647']");
    await building.scrollIntoViewIfNeeded();
    const box = (await building.boundingBox())!;
    // 名札や既存の44pxの操作範囲に頼らず、建物の上側を押す。
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 4);
    await expect(page).toHaveURL(/\/map\/blood-donation\/$/);
    await expect(page.getByRole("heading", { name: "献血", exact: true })).toBeVisible();
  }
});
