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

/**
 * 常設カードはカード全体が詳細ページへのリンク（名前の文字だけでなく写真や余白も押せる）。
 * カード内の「投票する →」等は別リンクなので、全面リンクの下に潜らず押せること。
 */
test.describe("timetable の常設カード", () => {
  test.skip(!showsContent("/timetable/"), "timetable が準備中のため");

  test("写真や余白を押しても詳細ページへ行き、CTAはCTAとして押せる", async ({ page }) => {
    await page.goto("/timetable/");

    const card = page.locator(".tl-permanent-card").first();
    const href = await card.locator(".tl-permanent-link").getAttribute("href");
    // 名前の文字から離れた右下の角を押す。常設はグリッドの下にあり画面外なので、先に見える位置へ
    await card.scrollIntoViewIfNeeded();
    const box = (await card.boundingBox())!;
    await page.mouse.click(box.x + box.width - 6, box.y + box.height - 6);
    await expect(page).toHaveURL(new RegExp(`${href}$`));

    await page.goto("/timetable/");
    const cta = page.locator(".tl-permanent-cta").first();
    // trial: 実際には遷移せず、他の要素に覆われずにクリックを受け取れるかだけを確かめる
    await cta.click({ trial: true });
  });
});
