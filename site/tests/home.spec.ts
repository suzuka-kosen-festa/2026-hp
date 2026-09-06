import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { describePage } from "./_shared";

describePage("home", "/");

// 画像が無い企画は写真枠ごと省く（詳細ページと揃える。Issue #60）。
// 実データに画像が入っても成り立つ検査なので、データ待ちで無効化されることはない。
test("PICK UP に NO IMAGE のプレースホルダーが出ない", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("NO IMAGE")).toHaveCount(0);
});

/**
 * 未公開ページへの導線には「準備中」を出す（押す前に空振りと分かるようにする）。
 *
 * 期待値を直書きすると release.json を更新したときにテストごと落ちるので、
 * release.json から引く。公開するページが増えても成り立つ。
 */
const releaseJson = fileURLToPath(new URL("../src/data/release.json", import.meta.url));
const { published } = JSON.parse(readFileSync(releaseJson, "utf8")) as { published: string[] };

test("未公開の導線にだけ準備中が付く", async ({ page }) => {
  await page.goto("/");

  const links = page.locator("header nav a");
  const count = await links.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    const href = await link.getAttribute("href");
    const hasBadge = (await link.locator(".soon").count()) > 0;

    // published に載っていれば公開扱い。セクション単位の記法もそのまま効く
    const isPublished = published.includes(href!);

    expect(hasBadge, `${href} の準備中バッジ`).toBe(!isPublished);
  }
});

/**
 * About のボタンはテーマ記事へ直リンクしている（About.astro の themeArticle）。
 * news.json の id を変えると静かに404になるので、行き先が実在するか見る。
 * 記事を消したり id を変えたりしたら、ここが落ちて気づける。
 */
test("About のリンク先の記事が実在する", async ({ page }) => {
  await page.goto("/");

  const href = await page.locator(".about a").first().getAttribute("href");
  expect(href, "About にリンクがありません").toBeTruthy();

  const res = await page.request.get(href!);
  expect(res.status(), `${href} が見つかりません`).toBe(200);
});
