import { expect, test } from "@playwright/test";
import { describePage, gatedLinkEntries, showsContent } from "./_shared";

describePage("timetable", "/timetable/");

/** 公開日を決めたCTA（バザーグランプリの投票。lib/entryLink.ts）を持つ常設企画 */
const gatedLinks = gatedLinkEntries();
/** 常設カードのCTAが出そろう時刻。公開日付きのCTAが無ければ時計はいじらない */
const ctaVisibleAt = gatedLinks.length > 0 ? Math.max(...gatedLinks.map((entry) => entry.opensAt)) : null;

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

    // 公開日より前はCTAが出ない企画（投票フォーム）があるので、出ている時刻にしてから開く
    if (ctaVisibleAt !== null) await page.clock.setFixedTime(ctaVisibleAt);
    await page.goto("/timetable/");
    const cta = page.locator(".tl-permanent-cta").first();
    await expect(cta, "常設カードのCTAが1つも出ていません").toBeVisible();
    // trial: 実際には遷移せず、他の要素に覆われずにクリックを受け取れるかだけを確かめる
    await cta.click({ trial: true });
  });
});

/**
 * 企画の場所と回の場所が違う企画（わらしべ長者は本部テント、結果発表だけ MainStage）は、
 * 回の場所（occurrence.location）で列に載る。企画の場所で判定すると表から消える。
 */
test("回ごとに場所を指定した回は、その場所の列に載る", async ({ page }) => {
  test.skip(!showsContent("/timetable/"), "timetable が準備中のため");

  await page.goto("/timetable/?tab=day2");
  const mainStage = page.locator(".tl-col-body.tl-stage-main");
  await expect(mainStage.locator(".tl-block", { hasText: "わらしべ長者" })).toHaveCount(1);
});

/**
 * 公開日を決めたCTA（バザーグランプリの投票フォーム）は、開催前は常設カードにも出さない。
 *
 * アイランドはマウント後に出し直すので、SSRのHTMLだけ見ても足りない。
 * 逆に当日になっても出ないほうが実害が大きいので、出る側もここで見る
 */
for (const entry of gatedLinks) {
  test.describe(`timetable の常設カードのCTAの公開日（${entry.id}）`, () => {
    test.skip(!showsContent("/timetable/"), "timetable が準備中のため");

    const card = (page: import("@playwright/test").Page) =>
      page.locator(".tl-permanent-card", { hasText: entry.name });

    test("公開日より前は出さない", async ({ page }) => {
      await page.clock.setFixedTime(entry.opensAt - 60 * 1000);
      await page.goto("/timetable/", { waitUntil: "networkidle" });

      await expect(card(page), `${entry.name} の常設カードがありません`).toHaveCount(1);
      await expect(
        card(page).getByRole("link", { name: entry.linkLabel }),
        "公開日より前なのにCTAが出ています",
      ).toHaveCount(0);
    });

    test("公開日になったら出す", async ({ page }) => {
      await page.clock.setFixedTime(entry.opensAt);
      await page.goto("/timetable/", { waitUntil: "networkidle" });

      const cta = card(page).getByRole("link", { name: entry.linkLabel });
      await expect(cta, "公開日になってもCTAが出ていません").toBeVisible();
      await expect(cta).toHaveAttribute("href", entry.link);
    });
  });
}
