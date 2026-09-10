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

test("初回訪問では1桁につき24枚の紙片で日数を作るOPを表示する", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-11T00:00:00+09:00"));
  await page.goto("/");

  const splash = page.getByLabel("開催まであと50日");
  await expect(splash).toBeVisible();
  await expect(splash.locator(".op-paper-placement")).toHaveCount(48);
  await expect(splash.locator(".op-offcut")).toHaveCount(9);
  await expect(splash.locator("video")).toHaveCount(0);
});

test("OPをスキップすると同じセッションでは再表示しない", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "SKIP" }).click();

  await expect(page.locator(".op-splash")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".op-splash")).toHaveCount(0);
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

/**
 * PICK UP のサムネイルは右（MTG 2026-09-06）。
 *
 * 画像を持つ企画が1件も無いと検査対象が消えるので、そのときだけ skip する。
 * 画像が入れば自動で検査に戻る。
 */
test("PICK UP のサムネイルが右にある", async ({ page }) => {
  await page.goto("/");

  const withPhoto = page.locator(".pc--compact:has(.pc__photo)").first();
  test.skip((await withPhoto.count()) === 0, "画像を持つ PICK UP がまだ無いため");

  const card = (await withPhoto.boundingBox())!;
  const photo = (await withPhoto.locator(".pc__photo").boundingBox())!;

  expect(
    photo.x,
    `サムネイルが左にあります（カード左端 ${Math.round(card.x)}px、写真左端 ${Math.round(photo.x)}px）`,
  ).toBeGreaterThan(card.x + card.width / 2);
});

/**
 * ファビコンの sizes 宣言が、favicon.ico の実体と一致していること（Issue #68）。
 *
 * Google はファビコンに「48pxの倍数の正方形」を要求する。実体には 48x48 が
 * 入っているのに sizes="32x32" とだけ申告していると、条件を満たさないものとして
 * 扱われる余地がある。
 *
 * 期待値は .ico を読んで作るので、アイコンを差し替えたときに宣言だけ古いまま
 * 残っていれば落ちる。
 */
function icoSizes(path: string) {
  const buf = readFileSync(path);
  const count = buf.readUInt16LE(4);

  return Array.from({ length: count }, (_, i) => {
    const w = buf[6 + i * 16] || 256;
    const h = buf[7 + i * 16] || 256;
    return `${w}x${h}`;
  });
}

const faviconPath = fileURLToPath(new URL("../public/favicon.ico", import.meta.url));

test("favicon の sizes 宣言が実体と一致する", async ({ page }) => {
  const expected = icoSizes(faviconPath);
  expect(expected, "favicon.ico に画像が入っていません").not.toHaveLength(0);

  /* BaseLayout（全ページ共通）と、本番でポスターを返す holding の両方。
     holding は mode が open になるとビルドから外れる（strip-dev-pages.mjs）ので、
     そのときだけ対象から外す */
  const release = JSON.parse(
    readFileSync(fileURLToPath(new URL("../src/data/release.json", import.meta.url)), "utf8"),
  ) as { mode: string };
  const paths = release.mode === "holding" ? ["/", "/holding/"] : ["/"];

  for (const path of paths) {
    await page.goto(path);

    const declared = await page
      .locator('link[rel="icon"][href="/favicon.ico"]')
      .getAttribute("sizes");

    expect(
      declared?.split(/\s+/).sort(),
      `${path} の宣言 "${declared}" が実体 [${expected.join(", ")}] と違います`,
    ).toEqual([...expected].sort());
  }
});
