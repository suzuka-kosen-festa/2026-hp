import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { describePage } from "./_shared";

describePage("home", "/");

// OPの検査は実行日に依存させない。当日以降は個別のテストで時計を進める。
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-30T23:59:59+09:00"));
});

for (const date of ["2026-11-02T00:00:00+09:00"]) {
  test(`${date} は初回もロゴからの再生もOPを出さない`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(date));
    await page.goto("/");
    await expect(page.locator("astro-island[component-export='default'][component-url*='OpSplash']")).not.toHaveAttribute("ssr", "");
    await expect(page.locator("#op-cover")).toHaveCount(0);
    await page.locator("#hero-logo-replay").click();
    await page.waitForTimeout(500);
    await expect(page.locator(".op-splash")).toHaveCount(0);
    await expect(page.getByLabel("開催まであと1日")).toHaveCount(0);
  });
}

for (const date of ["2026-10-31T00:00:00+09:00", "2026-11-01T23:59:59+09:00"]) {
  test(`${date} は開催前の既読でも当日写真OPを表示する`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(date));
    await page.addInitScript(() => sessionStorage.setItem("op-seen", "1"));
    await page.goto("/");
    await expect(page.locator(".festival-photo-stage")).toBeVisible();
    await expect(page.locator(".festival-photo-tile")).toHaveCount(55);
    await expect(page.getByLabel("開催まであと1日")).toHaveCount(0);
    await page.getByRole("button", { name: "SKIP" }).click();
    await expect(page.locator(".op-splash")).toHaveCount(0);
    await page.reload();
    await expect(page.locator("astro-island[component-url*='OpSplash']")).not.toHaveAttribute("ssr", "");
    await expect(page.locator(".op-splash")).toHaveCount(0);
    await page.locator("#hero-logo-replay").click();
    await expect(page.locator(".festival-photo-stage")).toBeVisible();
  });
}

test("当日写真OPは選別した55件だけを使い再生ごとに配置を変える", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00+09:00"));
  await page.goto("/");
  const tiles = page.locator(".festival-photo-tile");
  await expect(tiles).toHaveCount(55);
  const ids = () => tiles.evaluateAll(elements => elements.map(el => Number(el.getAttribute("data-photo-number"))));
  const first = await ids();
  expect(new Set(first).size).toBe(55);
  for (const excluded of [7, 2, 5, 11, 24, 23, 30, 35, 36, 37, 38, 39, 42, 44, 48]) expect(first).not.toContain(excluded);
  await page.getByRole("button", { name: "SKIP" }).click();
  await expect(page.locator(".op-splash")).toHaveCount(0);
  await page.locator("#hero-logo-replay").click();
  await expect(tiles).toHaveCount(55);
  expect(await ids()).not.toEqual(first);
});

test("当日写真OPの画像失敗では白いカバーを外しトップを表示する", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00+09:00"));
  await page.route("**/op/festival-photos.webp", route => route.abort());
  await page.goto("/");
  await expect(page.locator("#op-cover")).toHaveCount(0);
  await expect(page.locator(".op-splash")).toHaveCount(0);
  await expect(page.locator("#hero-logo-replay")).toBeVisible();
});

test("当日写真OPは勢いよく貼った55枚がずり落ち、5秒で終わる", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00+09:00"));
  await page.goto("/");
  await expect(page.locator(".festival-photo-stage")).toBeVisible();
  await expect(page.locator(".festival-photo-tile")).toHaveCount(55);
  await expect(page.locator(".festival-photo-pile")).toHaveCSS("mask-image", "none");
  await page.locator(".festival-photo-stage").evaluate(stage => {
    for (const animation of stage.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 1600; }
  });
  await expect(page.locator(".festival-photo-tile").first()).toHaveCSS("opacity", "1");
  await page.locator(".festival-photo-stage").evaluate(stage => {
    for (const animation of stage.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 4200; }
  });
  const allFallen = await page.locator(".festival-photo-tile").evaluateAll(tiles => tiles.every(tile => tile.getBoundingClientRect().top > innerHeight));
  expect(allFallen).toBe(true);
  await expect(page.locator(".festival-photo-artwork")).toHaveCSS("opacity", "1");
  await expect(page.locator(".op-splash")).toHaveCount(0, { timeout: 7000 });
});

// 画像が無い企画は写真枠ごと省く（詳細ページと揃える。Issue #60）。
// 実データに画像が入っても成り立つ検査なので、データ待ちで無効化されることはない。
test("PICK UP に NO IMAGE のプレースホルダーが出ない", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("NO IMAGE")).toHaveCount(0);
});

test("初回訪問では1桁につき24枚の紙片で日数を作るOPを表示する", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-11T00:00:00+09:00"));
  await page.addInitScript(() => sessionStorage.setItem("op-variant", "current"));
  await page.goto("/");

  const splash = page.getByLabel("開催まであと50日");
  await expect(splash).toBeVisible();
  await expect(splash.locator(".op-paper-placement")).toHaveCount(48);
  await expect(splash.locator(".op-offcut")).toHaveCount(9);
  await expect(splash.locator("video")).toHaveCount(0);
});

test("OP終了を再生開始から2.4秒後に予約する", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("op-variant", "current"));
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
  expect(scheduledTimeouts).toContain(2_400);

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
  expect(timing.wipe).toEqual({ delay: 1_600, duration: 800 });
  expect(timing.logo).toEqual({ delay: 2_000, duration: 400 });
  expect(timing.paperEnd).toBeLessThanOrEqual(1_400);
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
 * 常設企画のバナー（ミッションフォトラリー等）が PICK UP 枠（#pickup）になる。
 *
 * バナーはアプリを開いてほしい企画のためのものなので、画像は link へ直接つなぎ、
 * 遊び方・景品の説明は記事（/entry/<id>/）へのリンクで補う（EntryBanner）。
 * 期待値はデータから引くので、banner を持つ企画が無ければ自動で飛ばし、入れば自動で有効になる。
 */
const bannerEntries = ["booth", "department", "program"]
  .flatMap((name) =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../src/data/entries/${name}.json`, import.meta.url)), "utf8")),
  )
  .filter((entry: { banner?: string | null; hidden?: boolean }) => entry.banner && !entry.hidden) as {
  id: string;
  link?: string | null;
}[];

test("常設企画のバナーが PICK UP 枠に出て、アプリと記事へつながる", async ({ page }) => {
  test.skip(bannerEntries.length === 0, "バナーを持つ企画が無いため");
  await page.addInitScript(() => sessionStorage.setItem("op-seen", "1"));
  await page.goto("/");

  const banners = page.locator(".entry-banners .entry-banner");
  await expect(banners).toHaveCount(bannerEntries.length);

  for (const [i, entry] of bannerEntries.entries()) {
    const banner = banners.nth(i);
    const detail = `/entry/${entry.id}/`;
    // link が無い企画はバナー自体が記事へのリンクになる（EntryBanner）
    await expect(banner.locator(".entry-banner-link")).toHaveAttribute("href", entry.link ?? detail);
    if (entry.link) {
      await expect(banner.locator(".entry-banner-detail")).toHaveAttribute("href", detail);
    }
  }

  // バナーは #pickup セクションの中にあり、見出し「PICK UP」が付く
  const pickup = page.locator("section#pickup");
  await expect(pickup.getByRole("heading", { name: "PICK UP" })).toBeVisible();
  await expect(pickup.locator(".entry-banner")).toHaveCount(bannerEntries.length);
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

  // HamburgerMenu は client:idle なので、ハイドレーション前のボタンは押しても何も起きない。
  // CPUが混んでいると idle が遅れて取りこぼすので、astro-island の ssr 属性が外れる（=ハイドレーション済み）まで待つ
  await expect(page.locator('astro-island[component-url*="HamburgerMenu"]')).not.toHaveAttribute("ssr");
  await page.getByRole("button", { name: "メニューを開く" }).click();
  const menu = page.getByRole("navigation", { name: "メインナビゲーション" });
  await expect(menu).toBeVisible();

  const close = page.getByRole("button", { name: "メニューを閉じる" });
  await expect(close, "閉じるボタンが複数あります").toHaveCount(1);

  await close.click();
  await expect(menu).toHaveCount(0);
});

test("保存されたOPを初回表示と再再生で使い続ける", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("op-variant", "candidate1"));
  await page.goto("/");

  await expect(page.locator(".op-splash")).toHaveAttribute("data-op-variant", "candidate1");
  await page.getByRole("button", { name: "SKIP" }).click();
  await expect(page.locator(".op-splash")).toHaveCount(0);

  await page.evaluate(() => window.dispatchEvent(new Event("op:replay")));
  await expect(page.locator(".op-splash")).toHaveAttribute("data-op-variant", "candidate1");
});

test("再生途中の再再生でも最初に選んだ演出と新しい終了時刻を使う", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("op-variant", "candidate1"));
  await page.goto("/");
  await expect(page.locator(".op-splash")).toHaveAttribute("data-op-variant", "candidate1");
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.dispatchEvent(new Event("op:replay")));
  await page.waitForTimeout(1900);
  await expect(page.locator(".op-splash")).toHaveAttribute("data-op-variant", "candidate1");
  await expect(page.locator(".op-splash")).toHaveCount(0, { timeout: 2500 });
});

test("低減モーションでは初回OPを省略し、明示的な再再生はできる", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => sessionStorage.setItem("op-variant", "candidate2"));
  await page.goto("/");
  await expect(page.locator("#op-cover")).toHaveCount(0);
  await expect(page.locator(".op-splash")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("op:replay")));
  await expect(page.locator(".op-splash")).toHaveAttribute("data-op-variant", "candidate2");
});

test("データ節約回線では初回OPを省略する", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { value: { saveData: true } }));
  await page.goto("/");
  await expect(page.locator("#op-cover")).toHaveCount(0);
  await expect(page.locator(".op-splash")).toHaveCount(0);
});

test("未知の保存値は有効なOPに選び直す", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("op-variant", "unknown"));
  await page.goto("/");
  await expect(page.locator(".op-splash")).toHaveAttribute("data-op-variant", /^(current|candidate1|candidate2)$/);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("op-variant"))).toMatch(/^(current|candidate1|candidate2)$/);
});

for (const [value, expected] of [[0, "current"], [0.5, "candidate1"], [0.99, "candidate2"]] as const) {
  test(`抽選値${value}では${expected}を選ぶ`, async ({ page }) => {
    await page.addInitScript((randomValue) => { Math.random = () => randomValue; }, value);
    await page.goto("/");
    await expect(page.locator(".op-splash")).toHaveAttribute("data-op-variant", expected);
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("op-variant"))).toBe(expected);
  });
}

test("候補1は紙片の数字からロゴを組み立てて終了する", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-11T00:00:00+09:00"));
  await page.addInitScript(() => sessionStorage.setItem("op-variant", "candidate1"));
  await page.goto("/");
  const splash = page.locator(".op-splash");
  await expect(splash.locator(".op-candidate1 .digit-piece")).toHaveCount(8);
  await expect(splash.locator(".op-candidate1 .logo-piece")).toHaveCount(7);
  await expect(splash).toHaveCount(0, { timeout: 6000 });
});

test("候補2は学科柄と黄色いワイプからロゴへ切り替わる", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("op-variant", "candidate2"));
  await page.goto("/");
  const splash = page.locator(".op-splash");
  await expect(splash.locator(".op-candidate2 .opening-paper")).toHaveCount(3);
  await expect(splash.locator(".op2-third circle")).toHaveCount(6);
  await expect(splash.locator(".op-candidate2 .op2-wipe")).toHaveCount(1);
  const hero = splash.locator(".op2-hero");
  await expect(hero).toHaveCSS("opacity", "0");
  // 実際のキーフレームを3.3秒の状態へ進め、短い表示区間の取り逃しを避ける。
  await splash.locator(".op-candidate2").evaluate(stage => {
    for (const animation of stage.getAnimations({ subtree: true })) {
      animation.pause();
      animation.currentTime = 3300;
    }
  });
  await expect(hero).toHaveCSS("opacity", "1");
  await expect(splash).toHaveCount(0, { timeout: 6500 });
});

test("SNCT Games のバナーが出て、アプリへ直接つながる", async ({ page }) => {
  test.skip(!bannerEntries.some((e) => e.id === "snct-games"), "SNCT Games のバナーが無いため");
  await page.addInitScript(() => sessionStorage.setItem("op-seen", "1"));
  await page.goto("/");

  const banner = page.locator(".entry-banners .entry-banner", {
    has: page.locator('a[href="https://snct-games.vercel.app"]'),
  });
  await expect(banner).toHaveCount(1);
  await expect(banner.locator(".entry-banner-detail")).toHaveAttribute("href", "/entry/snct-games/");
});
