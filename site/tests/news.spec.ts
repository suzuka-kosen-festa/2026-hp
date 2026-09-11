import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { describePage } from "./_shared";

describePage("news", "/news/");

/**
 * 詳細ページは記事idを直書きすると、その記事を消したときにテストごと落ちる。
 * 実データ投入(#22等)で中身が入れ替わる前提なので、データから body を持つ最初の1件を引く。
 * src/lib/news.ts をimportすると json の import attribute で落ちるため、ファイルを直接読む。
 */
const newsJson = fileURLToPath(new URL("../src/data/news.json", import.meta.url));
const items: { id: string; date: string; body?: string }[] = JSON.parse(
  readFileSync(newsJson, "utf8"),
);

/**
 * 未来の日付のお知らせは詳細ページが生成されない（src/lib/news.ts の isPublished）。
 * ここで同じ条件を書いているのは、上のコメントのとおり lib を import できないため。
 * 判定を変えるときは両方直すこと。
 */
function isPublished(date: string) {
  const [year, month, day] = date.split(/[./-]/).map(Number);
  const now = new Date();

  return (
    new Date(year, month - 1, day).getTime() <=
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  );
}

const first = items.find((item) => item.body && isPublished(item.date));

if (first) {
  describePage("news 詳細", `/news/${first.id}/`);
} else {
  /* 全部が未来日付（リリース待ちの下書きだけ）のときは検査対象が無い。
     日付が来れば自動で検査に戻るので、恒久的なskipにはならない */
  test.skip("公開日を迎えた本文付きのお知らせが無いため、詳細ページを検査できません", () => {});
}

/**
 * お知らせ詳細の戻る導線（リリース後の指摘）。
 *
 * 「お知らせ一覧へ」の決め打ちだと、トップのNEWS枠から入った人が一覧に
 * 飛ばされて元の場所に戻れない。元いたページへ帰す。
 */
test.describe("お知らせ詳細の戻る導線", () => {
  const article = items.find((item) => item.body && isPublished(item.date));

  test.skip(!article, "公開日を迎えた本文付きのお知らせが無いため");

  test("履歴が無いときは一覧へ行く", async ({ page }) => {
    await page.goto(`/news/${article!.id}/`);

    const back = page.locator("a[data-back]");
    // JS無効でも機能するよう、href は常に一覧を指しておく
    await expect(back).toHaveAttribute("href", "/news/");

    await back.click();
    await expect(page).toHaveURL(/\/news\/$/);
  });

  test("トップのNEWS枠から来たときはトップへ戻る", async ({ page }) => {
    await page.goto("/");
    await page.locator(`a[href="/news/${article!.id}/"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/news/${article!.id}/$`));

    await page.locator("a[data-back]").click();
    await expect(page, "トップではなく一覧に戻っています").toHaveURL(/\/$/);
  });
});
