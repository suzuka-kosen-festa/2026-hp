import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { describePage, showsContent } from "./_shared";

type RawEntry = {
  id: string;
  category: string;
  name: string;
  tags: string[];
  isPermanent?: boolean;
  hideFromBooth?: boolean;
  linkFromBooth?: boolean;
  hidden?: boolean;
  banner?: string | null;
  link?: string | null;
};
// hidden の企画はサイトに出ないので、検査対象から外す（lib/loadEntries.ts と同じ扱い）
const entries = ["booth", "department", "program"]
  .flatMap(
    (name) =>
      JSON.parse(
        readFileSync(fileURLToPath(new URL(`../src/data/entries/${name}.json`, import.meta.url)), "utf8"),
      ) as RawEntry[],
  )
  .filter((entry) => !entry.hidden);

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

  // 中夜祭にだけ出るバンドで確かめる。r04 NotFound のように昼のステージにも出るバンドがいるので、
  // 名前を決め打ちせずデータから選ぶ（出演者が入れ替わってもテストが壊れないように）
  const lives = entries.filter((e) => e.category === "ライブ");
  const band = lives.find(
    (e) => e.tags.includes("中夜祭") && !lives.some((o) => o.name === e.name && o.tags.includes("day1")),
  )?.name;
  expect(band, "中夜祭にだけ出るバンドがデータにいません").toBeDefined();

  await page.goto("/booth/", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "ライブ" }).click();

  const day1 = page.getByRole("button", { name: "10/31 SAT" });
  const chuyasai = page.getByRole("button", { name: "中夜祭" });

  await day1.click();
  await expect(page.locator(".bl-card").first()).toBeVisible();
  await expect(page.locator(".bl-card", { hasText: band }), "中夜祭のバンドが10/31に出ています").toHaveCount(0);

  await chuyasai.click();
  await expect(day1, "2つ目のタグを押したら1つ目は外れる").toHaveAttribute("aria-pressed", "false");
  await expect(chuyasai).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".bl-card", { hasText: band })).toHaveCount(1);
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

/**
 * バナーのある常設企画（ミッションフォトラリー）は、カードではなくバナーで出し、押すと
 * 記事ではなくアプリ（link）へ直接飛ぶ。遊び方は記事にしか無いので、詳細ページへのリンクも添える。
 * link の無い企画（本部グッズ販売）は、バナー自体が詳細ページへのリンクになり、添えるリンクは出さない
 */
test("バナーのある常設企画はアプリへ直接飛ぶバナーで出す", async ({ page }) => {
  const banneredAll = entries.filter((entry) => entry.isPermanent && entry.banner);
  test.skip(boothHidden || banneredAll.length === 0, "/booth/ が準備中、またはバナーのある常設企画が無いため");

  await page.goto("/booth/", { waitUntil: "networkidle" });
  // 複数あるときは上下に並べる。順番はデータ（program.json）の並びどおり
  await expect(page.locator(".entry-banner")).toHaveCount(banneredAll.length);
  for (const [i, bannered] of banneredAll.entries()) {
    const banner = page.locator(".entry-banner").nth(i);
    await expect(banner.locator(".entry-banner-link")).toHaveAttribute("href", bannered.link ?? `/entry/${bannered.id}/`);
    await expect(banner.locator("img")).toHaveAttribute("alt", new RegExp(bannered.name));
    if (bannered.link) {
      await expect(banner.locator(".entry-banner-detail")).toHaveAttribute("href", `/entry/${bannered.id}/`);
    } else {
      await expect(banner.locator(".entry-banner-detail")).toHaveCount(0);
    }
    // バナー専用枠のカード（bl-permanent-card）には出さない
    await expect(page.locator(".bl-permanent-card", { hasText: bannered.name })).toHaveCount(0);
  }
  // 上部バナーに加え、イベントタブの通常一覧にもカードが出て詳細ページへリンクする
  await page.goto("/booth/?tab=%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88", { waitUntil: "networkidle" });
  for (const bannered of banneredAll) {
    const card = page.locator(`.bl-grid a[href="/entry/${bannered.id}/"]`);
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(bannered.name);
  }
});

/** SNCT Games のバナーはフォトラリーの下に並び、アプリ（snct-games.vercel.app）へ飛ぶ。景品が無いので詳細リンクの文言も変える */
test("SNCT Games のバナーがフォトラリーの下に出る", async ({ page }) => {
  const rally = entries.findIndex((e) => e.id === "mission-photo-rally");
  const games = entries.findIndex((e) => e.id === "snct-games");
  test.skip(boothHidden || games < 0, "/booth/ が準備中、または SNCT Games が無いため");

  await page.goto("/booth/", { waitUntil: "networkidle" });
  const banner = page.locator(".entry-banner", { has: page.locator('a[href="https://snct-games.vercel.app"]') });
  await expect(banner).toHaveCount(1);
  await expect(banner.locator(".entry-banner-detail")).toHaveText("遊び方を見る →");
  await expect(banner.locator(".entry-banner-detail")).toHaveAttribute("href", "/entry/snct-games/");
  if (rally >= 0) {
    const names = await page.locator(".entry-banner img").evaluateAll((els) => els.map((el) => el.getAttribute("alt")));
    expect(names.findIndex((n) => n?.startsWith("ミッションフォトラリー"))).toBeLessThan(
      names.findIndex((n) => n?.startsWith("SNCT Games")),
    );
  }
});

/** PC幅ではバナーを横に2枚並べる（縦に並べると大きすぎるため）。SP は縦のまま */
test("PC幅ではバナーが横に並び、SP幅では縦に並ぶ", async ({ page }) => {
  const bannered = entries.filter((entry) => entry.isPermanent && entry.banner);
  test.skip(boothHidden || bannered.length < 2, "/booth/ が準備中、またはバナーが2枚未満のため");

  const boxes = async () => {
    const list = page.locator(".entry-banner-link");
    await expect(list).toHaveCount(bannered.length);
    const a = (await list.nth(0).boundingBox())!;
    const b = (await list.nth(1).boundingBox())!;
    return { a, b };
  };
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/booth/", { waitUntil: "networkidle" });
  let { a, b } = await boxes();
  expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  expect(b.x).toBeGreaterThan(a.x + a.width);

  await page.setViewportSize({ width: 375, height: 800 });
  ({ a, b } = await boxes());
  expect(b.y).toBeGreaterThan(a.y + a.height);
});

/** SPは縦幅節約のため詳細リンクを出さない（読み上げ・タブ移動からも外れる）。PCでは見える */
test("バナーの詳細リンクはSPで非表示、PCで表示", async ({ page }) => {
  test.skip(boothHidden || !entries.some((e) => e.banner), "/booth/ が準備中、またはバナーが無いため");
  await page.goto("/booth/", { waitUntil: "networkidle" });
  const detail = page.locator(".entry-banner-detail").first();
  await expect(detail).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(detail).toBeVisible();
});
