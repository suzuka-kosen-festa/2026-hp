import { expect, test } from "@playwright/test";
import { describePage, showsContent } from "./_shared";

describePage("timetable", "/timetable/");

/**
 * 中夜祭は在校生限定。タブを公開する以上、注意書きが消えると一般の来場者が
 * 15時以降に体育館へ向かってしまう。見た目の調整で消されないよう検査しておく。
 */
test.describe("timetable の中夜祭タブ", () => {
  test.skip(!showsContent("/timetable/"), "timetable が準備中のため");

  test("在校生限定の注意書きと開場時刻を出し、中夜祭の企画は1日目タブに混ぜない", async ({ page }) => {
    await page.goto("/timetable/?tab=chuyasai");

    const tabs = page.getByRole("tab");
    await expect(tabs.nth(1), "中夜祭タブは1日目と2日目の間に置く").toHaveText("中夜祭");
    await expect(page.locator(".tl-notice")).toContainText("在校生限定");
    await expect(page.locator(".tl-marker"), "開場の帯がありません").toContainText("開場");
    await expect(page.locator(".tl-block").first()).toBeVisible();

    await tabs.nth(0).click();
    await expect(page.locator(".tl-notice")).toHaveCount(0);
    await expect(page.locator(".tl-marker")).toHaveCount(0);
    await expect(page.locator(".tl-block", { hasText: "格付けチェック" })).toHaveCount(0);
  });
});
