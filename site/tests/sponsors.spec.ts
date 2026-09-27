import { expect, test } from "@playwright/test";
import { describePage } from "./_shared";

describePage("sponsors", "/sponsors/");

/**
 * お知らせ「個人協賛を募集中です！」からの導線（MTG 2026-09-06）。
 *
 * 以前はフォームに直リンクしていて、何に申し込むのか分からないまま外部サイトへ
 * 飛んでいた。協賛ページの個人協賛セクションを挟むようにしている。
 *
 * 着地時に見出しがヘッダーに隠れないことも見る。Reveal が y:24 → 0 で
 * コンテンツを持ち上げるため、ブラウザの初回スクロールは登場前の位置を基準に
 * してしまう。scroll-margin-top でその分を見込んでいるので、Reveal の y を
 * 変えるとここが落ちる。
 */
test("お知らせから個人協賛セクションへ着地できる", async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });

    await page.goto("/news/");
    const link = page.locator('a[href="/sponsors/#individual"]');
    await expect(link, "個人協賛のお知らせがフォームに直リンクしています").toHaveCount(1);
    await link.click();

    const heading = page.locator("#individual h3");
    await expect(heading).toBeVisible();

    const head = (await heading.boundingBox())!;
    const header = (await page.locator("header").boundingBox())!;
    expect(
      head.y,
      `${width}px で見出しがヘッダー（高さ${Math.round(header.height)}px）に隠れています（Y=${Math.round(head.y)}）`,
    ).toBeGreaterThanOrEqual(header.height);

    // 説明と申し込み導線がセクション内にある
    await expect(page.getByText("協賛金窓口〈個人様用〉")).toBeVisible();
    await expect(page.locator("#individual a[href*='forms.gle']")).toHaveCount(1);
  }
});
