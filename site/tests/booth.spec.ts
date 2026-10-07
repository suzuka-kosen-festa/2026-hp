import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { describePage, showsContent } from "./_shared";

type RawEntry = { id: string; category: string; isPermanent?: boolean; hideFromBooth?: boolean; linkFromBooth?: boolean };
const entries = ["booth", "department", "program"].flatMap(
  (name) =>
    JSON.parse(
      readFileSync(fileURLToPath(new URL(`../src/data/entries/${name}.json`, import.meta.url)), "utf8"),
    ) as RawEntry[],
);

/** /booth/ が準備中のあいだは中身が無いので、ページ固有の検査は飛ばす（showsContent 参照） */
const boothHidden = !showsContent("/booth/");

describePage("booth", "/booth/");

/**
 * PCのタグフィルタは、縮小後のヘッダー高さに合わせて貼り付く（TabTagFilter.css）。
 * これは「フィルタが画面上端に達するより先にヘッダーが縮んでいる」ことが前提で、
 * フィルタより上のコンテンツ（ページタイトル・常設ブロック）が薄くなると前提が崩れ、
 * フィルタがヘッダーの下に潜って読めなくなる。
 * 実データ側の都合で崩れやすい（常設ブロックを外すと余裕が2pxになる）ため検査する。
 *
 * ヘッダーの縮小には transition が掛かっているので、遷移の途中は測らない
 * （高速スクロールでは一瞬 1px 未満だけ重なるが、これは実害ではない）。
 */
test.describe("booth PC", () => {
  test.skip(boothHidden, "/booth/ が準備中のため（src/data/release.json）");

  test("スクロール中にタグフィルタがヘッダーの下に潜らない", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("op-seen", "1");
      } catch {
        /* noop */
      }
    });
    await page.goto("/booth/", { waitUntil: "networkidle" });

    const result = await page.evaluate(async () => {
      document.documentElement.style.scrollBehavior = "auto";
      const filter = document.querySelector(".tab-tag-filter");
      const header = document.querySelector(".site-header");
      if (!filter || !header) return null;

      // 縮小アニメーションが動いている間は測らない。
      // 高さが両端の値に近いかで判定すると、遷移の終わりぎわ（56.8px等）を
      // 完了と誤認するため、実際に走っているアニメーションの有無で見る
      const isAnimating = () =>
        header.getAnimations({ subtree: true }).some((a) => a.playState === "running");

      let min = Infinity;
      let minY = -1;
      let measured = 0;
      for (let y = 0; y <= 900; y += 10) {
        window.scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(r));
        if (isAnimating()) continue;
        const headerBox = header.getBoundingClientRect();
        measured++;
        const gap = filter.getBoundingClientRect().top - headerBox.bottom;
        if (gap < min) {
          min = gap;
          minY = y;
        }
      }
      window.scrollTo(0, 0);
      return { min, minY, measured };
    });

    expect(result, "フィルタとヘッダーが見つかりません").not.toBeNull();
    expect(result!.measured, "計測できた位置が少なすぎます").toBeGreaterThan(50);
    expect(
      result!.min,
      `タグフィルタがヘッダーの下に潜っています（scrollY=${result!.minY} で ${result!.min?.toFixed(1)}px）。` +
        "Header.astro の SHRINK_AT を下げるか、TabTagFilter.css の PC の top を --header-height-pc 側へ寄せてください",
    ).toBeGreaterThanOrEqual(0);
  });
});

/**
 * カードのチップは内部キー（day1 / M科）ではなく表示名を出す。
 * 表示名が絞り込みバー側にしか無かったため、同じ画面でフィルタは「機械」、
 * カードは「M科」と違う言葉が出ていた（Issue #53）。
 */
test("カードのチップに内部キーが出ない", async ({ page }) => {
  test.skip(boothHidden, "/booth/ が準備中のため（src/data/release.json）");

  await page.goto("/booth/", { waitUntil: "networkidle" });

  // 特定のタブに決め打ちすると、そのタブのデータが空の間（学科展示は実データ待ち）に
  // 何も検査しなくなるので、全タブのチップを集めて見る
  const chips: string[] = [];
  for (const tab of await page.getByRole("tab").all()) {
    await tab.click();
    chips.push(...(await page.locator(".bl-chip").allTextContents()));
  }
  expect(chips.length, "どのタブのカードにもチップが1つも出ていません").toBeGreaterThan(0);
  expect(
    chips.filter((text) => /^(day[12]|[MEICS]科)$/.test(text.trim())),
    "内部キーがそのままチップに出ています",
  ).toEqual([]);
});

/**
 * タグは1つだけ選べる（OR検索はしない）。また中夜祭は day1 の夜に開催されるが、
 * 日付では絞り込まず「中夜祭」タグでだけ出す（timetable の日タブと同じ扱い）。
 */
test("タグは1つだけ選べ、中夜祭の企画は日付の絞り込みに混ざらない", async ({ page }) => {
  test.skip(boothHidden, "/booth/ が準備中のため（src/data/release.json）");

  await page.goto("/booth/", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "ライブ" }).click();

  const day1 = page.getByRole("button", { name: "10/31 SAT" });
  const chuyasai = page.getByRole("button", { name: "中夜祭" });

  await day1.click();
  await expect(page.locator(".bl-card").first()).toBeVisible();
  await expect(page.locator(".bl-card", { hasText: "r04 NotFound" }), "中夜祭のバンドが10/31に出ています").toHaveCount(0);

  await chuyasai.click();
  await expect(day1, "2つ目のタグを押したら1つ目は外れる").toHaveAttribute("aria-pressed", "false");
  await expect(chuyasai).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".bl-card", { hasText: "r04 NotFound" })).toHaveCount(1);
});

/** hideFromBooth の枠（わらしべ長者・バザーGPの紹介枠）は、timetable の表にだけ載せて booth には出さない */
test("timetable専用の枠は booth の一覧に出ない", async ({ page }) => {
  test.skip(boothHidden, "/booth/ が準備中のため（src/data/release.json）");

  await page.goto("/booth/?tab=イベント", { waitUntil: "networkidle" });
  await expect(page.locator(".bl-card").first()).toBeVisible();
  await expect(page.locator(".bl-card", { hasText: "紹介" })).toHaveCount(0);
});

/**
 * linkFromBooth の企画は、出店など既定でリンクにしないカテゴリでもカードから詳細ページへ飛べる。
 * 企画を決め打ちせずデータから拾うので、該当する企画が無い間だけ skip になる
 */
test("linkFromBooth の企画はカードから詳細ページへ飛べる", async ({ page }) => {
  const linked = entries.find((entry) => entry.linkFromBooth && !entry.isPermanent && !entry.hideFromBooth);
  test.skip(boothHidden || !linked, "/booth/ が準備中、または linkFromBooth の企画が無いため");

  await page.goto(`/booth/?tab=${encodeURIComponent(linked!.category)}`, { waitUntil: "networkidle" });
  const card = page.locator(`a[href="/entry/${linked!.id}/"]`);
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("view more");
});
