import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { describePage, showsContent } from "./_shared";

// 開催回・対象・定員・注記を全部持つ、いま一番情報量の多いエントリ
describePage("entry", "/entry/workshop-ai-sorting-robot/");

/**
 * 写真を用意できない企画は今後も存在するので、画像なしを正式なレイアウトとして扱う。
 * 16:9の「NO IMAGE」枠を出すと、その高さぶんがまるごと無駄になる（Issue #56）。
 * 実データが入って画像の有無が変わっても追従するよう、データから引いて検査する。
 */
const entriesDir = new URL("../src/data/entries/", import.meta.url);
const entries: { id: string; image?: string; categoryLabel?: string }[] = ["booth", "department", "program"].flatMap((name) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`${name}.json`, entriesDir)), "utf8")),
);

const withoutImage = entries.find((entry) => !entry.image);
const withImage = entries.find((entry) => entry.image);

/**
 * 画像ありも画像なしも見つからないと両方の describe が skip になり、
 * 「常に緑だが何も検査していない」状態になる。データ側が空になったことに
 * 気づけるよう、ここで明示的に落とす。
 */
test("画像まわりを検査できるデータがある", () => {
  expect(
    withoutImage ?? withImage,
    "entries が空です。画像まわりの検査が1件も走っていません",
  ).toBeTruthy();
});

test.describe("entry の画像", () => {
  test.skip(!withoutImage, "画像なしのエントリが無いため");

  test("画像が無い企画は写真枠ごと出さない", async ({ page }) => {
    await page.goto(`/entry/${withoutImage!.id}/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".photo"), "画像が無いのに写真枠が残っています").toHaveCount(0);
    await expect(page.getByText("NO IMAGE"), "NO IMAGE のプレースホルダが出ています").toHaveCount(0);
    // 中身が消えていないことも見る（枠を消しすぎていないか）
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("entry の画像（あり）", () => {
  test.skip(!withImage, "画像ありのエントリがまだ無いため");

  test("画像がある企画は今までどおり写真枠を出す", async ({ page }) => {
    await page.goto(`/entry/${withImage!.id}/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".photo img")).toHaveCount(1);
  });
});

/**
 * 戻る導線（MTG 2026-09-06）。
 *
 * 以前は「← 企画一覧へ」で /booth/ に決め打ちだった。v1では /booth/ が準備中なので、
 * トップのPICK UPから入った人が戻ろうとすると準備中ページに着地していた。
 *
 * サイト内から来たときは履歴で元のページへ、履歴が無いとき（検索やQRからの
 * 直接着地）はトップへ。JSが動かなくても href="/" の普通のリンクとして機能する。
 */
test.describe("entry の戻る導線", () => {
  test("直接来たときはトップへ戻る", async ({ page }) => {
    await page.goto("/entry/workshop-ai-sorting-robot/");

    const back = page.locator("a[data-back]");
    await expect(back, "戻るリンクがありません").toHaveCount(1);
    // JS無効でも機能するよう、href は常にトップを指しておく
    await expect(back).toHaveAttribute("href", "/");

    await back.click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("サイト内から来たときは元のページへ戻る", async ({ page }) => {
    /* 一覧が準備中だとカードが無く、たどれない。published に足せば検査に戻る */
    test.skip(!showsContent("/booth/"), "/booth/ が準備中のため");

    await page.goto("/booth/");
    await page.locator('a[href^="/entry/"]').first().click();
    await expect(page).toHaveURL(/\/entry\//);

    await page.locator("a[data-back]").click();
    await expect(page, "元いた一覧ではなくトップに戻っています").toHaveURL(/\/booth\/$/);
  });
});

/**
 * 表示用のカテゴリ名（MTG 2026-09-06）。
 *
 * ワークショップは青いテープに「イベント」と出ていた。`category` は booth の
 * 絞り込みタブとタイムテーブル掲載を決めているので表示の都合で書き換えられず、
 * `categoryLabel` で表示だけを差し替えている。
 *
 * 期待値はデータから引くので、他の企画に付けても成り立つ。
 */
const withLabel = entries.filter((entry) => (entry as { categoryLabel?: string }).categoryLabel);

test.describe("表示用のカテゴリ名", () => {
  test.skip(withLabel.length === 0, "categoryLabel を持つ企画が無いため");

  test("categoryLabel があればそれを出す", async ({ page }) => {
    for (const entry of withLabel) {
      const label = (entry as { categoryLabel?: string }).categoryLabel!;
      await page.goto(`/entry/${entry.id}/`, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".cat"), `${entry.id} のカテゴリ表示`).toHaveText(label);
    }
  });
});
