import { expect, test } from "@playwright/test";
import { describePage, showsContent } from "./_shared";

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
  await page.getByRole("tab", { name: "学科展示" }).click();

  const chips = await page.locator(".bl-chip").allTextContents();
  expect(chips.length, "学科展示のカードにチップが1つも出ていません").toBeGreaterThan(0);
  expect(
    chips.filter((text) => /^(day[12]|[MEICS]科)$/.test(text.trim())),
    "内部キーがそのままチップに出ています",
  ).toEqual([]);
});
