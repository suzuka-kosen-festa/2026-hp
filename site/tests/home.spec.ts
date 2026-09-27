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

test("OP終了を再生開始から4.2秒後に予約する", async ({ page }) => {
  await page.addInitScript(() => {
    const scheduledTimeouts: number[] = [];
    const originalSetTimeout = window.setTimeout.bind(window);
    Object.defineProperty(window, "__scheduledTimeouts", { value: scheduledTimeouts });
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      scheduledTimeouts.push(timeout ?? 0);
      return originalSetTimeout(handler, timeout, ...args);
    }) as typeof window.setTimeout;
  });
  await page.goto("/");
  await expect(page.locator(".op-splash")).toBeVisible();

  const scheduledTimeouts = await page.evaluate(
    () => (window as Window & { __scheduledTimeouts: number[] }).__scheduledTimeouts,
  );
  expect(scheduledTimeouts).toContain(4_200);

  const timing = await page.evaluate(() => {
    const animationTiming = (selector: string) => {
      const animation = document.querySelector(selector)?.getAnimations()[0];
      const effectTiming = animation?.effect?.getTiming();
      return effectTiming && { delay: effectTiming.delay, duration: effectTiming.duration };
    };
    const paperAnimations = [...document.querySelectorAll(".op-paper-placement")]
      .map((paper) => paper.getAnimations()[0]?.effect?.getComputedTiming().endTime)
      .filter((endTime): endTime is number => typeof endTime === "number");

    return {
      wipe: animationTiming(".op-wipe"),
      logo: animationTiming(".op-finale img"),
      paperEnd: Math.max(...paperAnimations),
    };
  });
  expect(timing.wipe).toEqual({ delay: 3_400, duration: 800 });
  expect(timing.logo).toEqual({ delay: 3_800, duration: 400 });
  expect(timing.paperEnd).toBeLessThanOrEqual(3_100);
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

/**
 * お知らせから PICK UP へ着地する（Issue #104）。
 *
 * 見出しは Reveal で下から持ち上がるので、scroll-margin が足りないと
 * ヘッダーの下に潜る。
 *
 * html は scroll-behavior: smooth なので、クリック直後に測るとまだスクロールが
 * 始まったばかりで、見出しは画面のはるか下にある（＝ヘッダーより下なので素通りする）。
 * スクロールと Reveal の登場が止まるのを待ってから測る。
 *
 * PICK UP はページの最下部にあるので、画面が縦に長いとページの終わりで
 * スクロールが止まり、scroll-margin が無くても見出しが下に余る（検査が効かない）。
 * 実機のSafariに近い、縦の短い画面で測る。
 */
test("お知らせから PICK UP へ着地できる", async ({ page }) => {
  // OPは初回訪問時に全画面を覆うので見た扱いにする（着地位置の検査の邪魔になる）
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("op-seen", "1");
    } catch {
      /* noop */
    }
  });

  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 640 });

    await page.goto("/news/");
    const link = page.locator('a[href="/#pickup"]');
    await expect(link, "PICK UP へ案内するお知らせがありません").toHaveCount(1);
    await link.click();

    const heading = page.locator("#pickup h2");
    await expect(heading, `${width}px で PICK UP までスクロールしていません`).toBeInViewport();

    // 150ms あけて2回測り、同じ位置なら止まったとみなす
    let settledY: number | null = null;
    await expect
      .poll(async () => {
        const before = (await heading.boundingBox())!.y;
        await page.waitForTimeout(150);
        const after = (await heading.boundingBox())!.y;
        settledY = before === after ? after : null;
        return settledY;
      }, { message: `${width}px でスクロールが止まりません` })
      .not.toBeNull();

    const header = (await page.locator("header").boundingBox())!;
    expect(
      settledY!,
      `${width}px で見出しがヘッダー（高さ${Math.round(header.height)}px）に隠れています（Y=${Math.round(settledY!)}）`,
    ).toBeGreaterThanOrEqual(header.height);
  }
});

/**
 * SPメニューの閉じるボタンは、✕に変形したハンバーガー1つだけであること。
 *
 * 以前はメニュー内にも別の「✕」ボタンを置いており、同じ右上の位置で
 * ハンバーガーの✕と重なって二重に描画されていた。
 * 閉じるボタンが1つだけ見えていること、それを押すと閉じることを見る。
 */
test("SPメニューの閉じるボタンは1つだけで、押すと閉じる", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("op-seen", "1"));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await page.getByRole("button", { name: "メニューを開く" }).click();
  const menu = page.getByRole("navigation", { name: "メインナビゲーション" });
  await expect(menu).toBeVisible();

  const close = page.getByRole("button", { name: "メニューを閉じる" });
  await expect(close, "閉じるボタンが複数あります").toHaveCount(1);

  await close.click();
  await expect(menu).toHaveCount(0);
});
