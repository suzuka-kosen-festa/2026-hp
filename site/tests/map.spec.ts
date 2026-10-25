import { describePage } from "./_shared";

describePage("map", "/map/");
for (const sub of ["food", "exhibition", "multimedia", "headquarters", "innovation-plaza"]) describePage(`map/${sub}`, `/map/${sub}/`);

import { test, expect } from "@playwright/test";
import { showsContent } from "./_shared";
import { readFileSync } from "node:fs";
const site = JSON.parse(readFileSync(new URL("../src/data/site.json", import.meta.url), "utf8"));
// ゲーム大会が hidden の間はMAPでも案内しない（lib/loadEntries.ts と同じ扱い）。hidden を外すと大会の検査が自動で有効に戻る。
const gameHidden = (JSON.parse(readFileSync(new URL("../src/data/entries/program.json", import.meta.url), "utf8")) as { id: string; hidden?: boolean }[])
  .some((entry) => entry.id === "game-tournament" && entry.hidden);

test.describe("MAP案内", () => {
  test.skip(!showsContent("/map/"), "公開設定による準備中。通常プレビューでは実行する");
  test("学科展示からMAPへ戻れ、通常のBOOTH訪問にはMAP用の戻る導線を出さない", async ({ page }) => {
    await page.goto("/map/");
    const source = page.locator(".map-area-list [data-area='04']");
    await source.click();
    await expect(page.getByRole("tab", { name: "学科展示", exact: true })).toHaveAttribute("aria-selected", "true");
    const back = page.getByRole("link", { name: "← MAPに戻る", exact: true });
    await expect(back).toBeInViewport();
    await back.click();
    await expect(page).toHaveURL(/\/map\/$/);
    await expect(source).toBeInViewport();
    await page.goto("/booth/");
    await expect(page.locator("[data-map-return='department']")).toBeHidden();
  });
  test("バザーは種類を切り替えて全店を一画面に収め、詳細から同じ種類へ戻れる", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/map/food/");
    for (const [group, name, count] of [["food", "フード", 12], ["sweets", "スイーツ", 10]] as const) {
      await page.getByRole("tab", { name: new RegExp(name) }).click();
      const panel = page.getByRole("tabpanel", { name: new RegExp(name) });
      await expect(panel.getByRole("link")).toHaveCount(count);
      await expect(page.getByRole("tabpanel")).toHaveCount(1);
      const geometry = await panel.evaluate((el) => ({ bottom: el.getBoundingClientRect().bottom, height: innerHeight, scroll: document.documentElement.scrollWidth - innerWidth }));
      expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);
      expect(geometry.scroll).toBeLessThanOrEqual(1);
      await panel.getByRole("link").first().click();
      await page.getByRole("link", { name: "← MAPに戻る", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`group=${group}`));
      await expect(page.getByRole("tab", { name: new RegExp(name) })).toHaveAttribute("aria-selected", "true");
    }
    await page.getByRole("tab", { name: /スイーツ/ }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("tab", { name: /フード/ })).toBeFocused();
    await page.reload();
    await expect(page.getByRole("tab", { name: /フード/ })).toHaveAttribute("aria-selected", "true");
  });
  test("フードとスイーツを切り替えても、タブ・一覧・その下の内容が上下しない", async ({ page }) => {
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/map/food/");
      const measure = () => page.evaluate(() => ({
        tabs: document.querySelector("[data-stall-tabs]")!.getBoundingClientRect().top,
        list: document.querySelector("[data-stall-group]:not([hidden])")!.getBoundingClientRect().top,
        note: document.querySelector(".tea-note")!.getBoundingClientRect().top,
        page: document.documentElement.scrollHeight,
      }));
      const food = await measure();
      await page.getByRole("tab", { name: /スイーツ/ }).click();
      await expect(page.getByRole("tabpanel", { name: /スイーツ/ })).toBeVisible();
      expect(await measure(), `${width}px`).toEqual(food);
      // 選んでいない一覧は見えず、Tabでも移れない。
      await expect(page.getByRole("tabpanel")).toHaveCount(1);
      await expect(page.locator("[data-stall-group='food'] a").first()).toBeHidden();
    }
  });

  test("控室と運営用の用途を表示せず、飲食スペースと来場者向け会場案内は残す", async ({ page }) => {
    await page.goto("/map/exhibition/");
    await expect(page.locator("main")).not.toContainText(/控室|一時避難場所/);
    await expect(page.locator("#floor-1F")).toContainText("飲食スペース");
    await page.getByRole("tab", { name: "2F", exact: true }).click();
    await expect(page.locator("#floor-2F")).toContainText("雨天時のアコギ会場");
    await expect(page.locator("#floor-2F [data-stairs-symbol]").first()).toBeVisible();
  });
  test("教室リンクでページ内を移動した後もMAPに戻るボタンは全体図へ戻る", async ({ page }) => {
    await page.goto("/map/");
    await page.locator(".map-area-list [data-area='02']").click();
    await page.locator("#floor-1F .indoor-map").getByRole("link").first().click();
    await expect(page).toHaveURL(/#room-/);
    await page.getByRole("link", { name: "← MAPに戻る", exact: true }).first().click();
    await expect(page).toHaveURL(/\/map\/$/);
  });
  test("教室を押すとその教室の企画一覧を見て詳細へ進める", async ({ page }) => {
    await page.goto("/map/exhibition/?floor=1F");
    const diagram = page.locator("#floor-1F .indoor-map");
    const room = diagram.getByRole("link", { name: "C科棟 1F・1Eの企画を見る", exact: true });
    await room.click();
    const list = page.locator("[data-room-list='C:1F:1E']");
    await expect(list).toBeInViewport();
    await expect(list.locator("a")).toHaveCount(2);
    await list.locator("a[href='/entry/rec-shashin/']").click();
    await expect(page).toHaveURL(/\/entry\/rec-shashin\/$/);
    await page.getByRole("link", { name: "← MAPに戻る", exact: true }).click();
    await expect(page.getByRole("tab", { name: "1F", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(list).toBeInViewport();
  });
  test("03からゲーム会場の教室を確認して詳細へ進める", async ({ page }) => {
    test.skip(gameHidden, "ゲーム大会は非公開中。hidden を外すと実行する");
    await page.goto("/map/");
    await page.locator(".campus-map [data-area='03']").click();
    await expect(page).toHaveURL(/\/map\/game\/$/);
    await expect(page.locator(".indoor-map")).toBeInViewport();
    await expect(page.locator(".map-location")).toContainText("C科棟1F・第二合併講義室");
    const room = page.locator("[data-room='第二合併講義室']");
    await expect(room).toHaveAttribute("data-selected-room", "true");
    await room.click();
    const info = page.locator("#game-info");
    await expect(info).toBeInViewport();
    await expect(page.locator("[data-game-part]")).toHaveCount(2);
    await expect(info).toContainText("受付 9:45〜10:45");
    await expect(info).toContainText("最大64人");
    expect(await page.locator(".indoor-map").evaluate((el) => Boolean(el.compareDocumentPosition(document.querySelector("#game-info")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    await info.locator("a[href='/entry/game-tournament/']").click();
    await expect(page).toHaveURL(/\/entry\/game-tournament\/$/);
    await page.getByRole("link", { name: "← MAPに戻る", exact: true }).click();
    await expect(page.locator("#game-info")).toBeInViewport();
  });
  test("スマホで教室を押しても図は動かず、一覧の教室に枠が付く", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/map/exhibition/?floor=1F");
    const diagram = page.locator("#floor-1F .indoor-map");
    const before = await page.evaluate(() => scrollY);
    await diagram.getByRole("link", { name: "C科棟 1F・1Eの企画を見る", exact: true }).click();
    const list = page.locator("[data-room-list='C:1F:1E']");
    await expect(list).toHaveAttribute("data-selected-room", "true");
    await expect(list).toBeFocused();
    await expect(page).toHaveURL(/#room-C-1F-/);
    expect(await page.evaluate(() => scrollY)).toBe(before);
    await expect(diagram.getByRole("group", { name: "1Fの教室配置図" })).toBeInViewport({ ratio: 1 });
  });
  test("教室を選んだ後に階を変えて再読み込みしても新しい階を開く", async ({ page }) => {
    await page.goto("/map/exhibition/?floor=2F");
    await page.locator("#floor-2F .indoor-map").getByRole("link", { name: "C科棟 2F・2Iの企画を見る", exact: true }).click();
    await expect(page.locator("[data-room-list='C:2F:2I']")).toBeFocused();
    await page.getByRole("tab", { name: "3F", exact: true }).click();
    await page.reload();
    await expect(page.getByRole("tab", { name: "3F", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#floor-3F")).toBeVisible();
  });
  test("JavaScriptなしでもゲーム教室の強調と教室リンクを使える", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
    try {
      const page = await context.newPage();
      if (!gameHidden) {
        await page.goto("http://localhost:4325/map/game/");
        const room = page.locator("[data-room='第二合併講義室']");
        await expect(room).toHaveAttribute("data-selected-room", "true");
        await room.click();
        await expect(page.locator("#game-info")).toBeInViewport();
        await page.locator("#game-info a[href='/entry/game-tournament/']").click();
        await expect(page).toHaveURL(/\/entry\/game-tournament\/$/);
      }
      await page.goto("http://localhost:4325/timetable/?tab=day1#stage-LiveStage");
      await page.getByRole("link", { name: "MAPに戻る", exact: false }).click();
      await expect(page).toHaveURL(/\/map\/$/);
    } finally { await context.close(); }
  });
  test("教室選択と階変更の後にブラウザで戻るとURLの階を表示する", async ({ page }) => {
    await page.goto("/map/exhibition/?floor=2F");
    await page.locator("#floor-2F .indoor-map").getByRole("link", { name: "C科棟 2F・2Iの企画を見る", exact: true }).click();
    await expect(page.locator("[data-room-list='C:2F:2I']")).toBeFocused();
    await page.getByRole("tab", { name: "3F", exact: true }).click();
    await page.goBack();
    await expect(page).toHaveURL(/\/map\/exhibition\/\?floor=2F$/);
    await expect(page.getByRole("tab", { name: "2F", exact: true })).toHaveAttribute("aria-selected", "true");
  });
  test("会場札の名称と一覧の操作説明を細かくしすぎず読める", async ({ page }) => {
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/map/");
      const names = await page.locator(".campus-map .area-name").evaluateAll((nodes) => nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)));
      expect(names).toHaveLength(4);
      expect(names.every((size) => size >= (width === 375 ? 12 : 14))).toBe(true);
      const descriptions = await page.locator(".map-area-list .area-copy > small").evaluateAll((nodes) => nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)));
      expect(descriptions).toHaveLength(4);
      expect(descriptions.every((size) => size >= 14)).toBe(true);
    }
  });
  test("エリア一覧は内部の案内へ進む矢印で統一する", async ({ page }) => {
    await page.goto("/map/");
    await expect(page.locator(".map-area-list .action-arrow")).toHaveText(Array(4).fill("→"));
    await page.locator(".map-area-list [data-area='01']").click();
    await expect(page).toHaveURL(/\/map\/food\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("飲食バザー");
  });
  test("飲食マップの凡例は種類名を重複せず読み上げ用に伝える", async ({ page }) => {
    await page.goto("/map/food/");
    await expect(page.locator(".bazaar-legend")).toMatchAriaSnapshot("- paragraph: フード スイーツ");
  });
  test("確定した名称でMAPの出店を探せて、既存IDの詳細へ進める", async ({ page }) => {
    await page.goto("/map/food/");
    for (const [id, name] of [["food-5e", "ベーコンチーズ巻き"], ["food-5m", "焼き鳥"], ["food-volleyball", "焼きドーナツ"]]) {
      const link = page.locator(`[data-stall-group] a[href='/entry/${id}/']`);
      await expect(link.locator("strong")).toHaveText(name);
      await expect(page.locator(`.bazaar-map a[href='/entry/${id}/']`)).toHaveAttribute("aria-label", new RegExp(name));
    }
    await page.locator("[data-stall-group] a[href='/entry/food-5e/']").click();
    await expect(page).toHaveURL(/\/entry\/food-5e\/$/);
    // 詳細ページ・共有データはMAPの表記確定では書き換えない。
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ベーコンチーズ巻");
    await page.goto("/map/multimedia/");
    await expect(page.locator("a[href='/entry/food-sado/'] strong")).toHaveText("抹茶・栗きんとん");
  });
  test("確定した展示企画名と団体名を分け、教室とIDを維持する", async ({ page }) => {
    await page.goto("/map/exhibition/?floor=3F");
    for (const [id, name, group, room] of [
      ["rec-suiei", "射的・輪投げ", "水泳部", "3S"],
      ["rec-douga", "教員カードゲーム", "動画同好会", "2C"],
      ["rec-5i", "シール", "5I", "2S"],
    ]) {
      const link = page.locator(`[data-floor-panel='3F'] a[href='/entry/${id}/']`);
      await expect(link.locator("strong")).toHaveText(name);
      await expect(link.locator("small")).toContainText(group);
      await expect(link.locator("small")).toContainText(`C科棟 3F・${room}`);
    }
    await page.locator("a[href='/entry/rec-suiei/']").click();
    await expect(page).toHaveURL(/\/entry\/rec-suiei\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("水泳部");
    await page.goto("/map/exhibition/?floor=2F");
    for (const [id, name] of [["rec-procon", "プロコンプロジェクト"], ["rec-gcon", "NEO縁日by@uzumeland"]]) {
      await expect(page.locator(`[data-floor-panel='2F'] a[href='/entry/${id}/'] strong`)).toHaveText(name);
    }
  });
  test("スマホでもマルチメディア棟を正式名称から見つけられる", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/map/");
    const venue = page.locator(".campus-map [data-venue='multimedia']");
    expect((await venue.innerText()).replace(/\s/g, "")).toBe("マルチメディア棟");
    await venue.click();
    await expect(page).toHaveURL(/\/map\/multimedia\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("マルチメディア棟");
  });
  test("I科棟の短い教室名を縮小しすぎず、図の区画に収める", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const floor of ["1F", "2F"]) {
      await page.goto(`/map/exhibition/?floor=${floor}`);
      await page.evaluate(() => document.fonts.ready);
      const labels = page.locator(`[data-floor-panel='${floor}'] .i-room-code`).filter({ hasText: /^[1-5][CEIMS]$/ });
      expect(await labels.count()).toBeGreaterThan(0);
      const sizes = await labels.evaluateAll((nodes) => nodes.map((node) => {
        const text = node as SVGGraphicsElement;
        return parseFloat(getComputedStyle(text).fontSize) * Math.abs(text.getScreenCTM()!.a);
      }));
      expect(sizes.every((size) => size >= 10.9)).toBe(true);
    }
  });
  test("校内図の全階段を同じ記号で示し、区画に収めて凡例で説明する", async ({ page }) => {
    for (const width of [375, 320, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      for (const [floor, count] of [["1F", 3], ["2F", 4], ["3F", 2]] as const) {
        await page.goto(`/map/exhibition/?floor=${floor}`);
        const figure = page.locator(`[data-floor-panel='${floor}'] .indoor-map`);
        const stairs = figure.locator("[data-room='階段']");
        await expect(stairs).toHaveCount(count);
        await expect(stairs.locator("[data-stairs-symbol]")).toHaveCount(count);
        await expect(stairs.locator("text")).toHaveCount(0);
        const key = figure.locator("figcaption [data-stairs-key]");
        await expect(key).toHaveCount(1);
        await expect(figure.locator("figcaption")).toContainText("＝階段");
        const legendPath = await key.getAttribute("d");
        const symbols = await stairs.locator("[data-stairs-symbol]").evaluateAll((nodes) => nodes.map((node) => {
          const path = node as SVGGraphicsElement;
          const rect = path.previousElementSibling as SVGGraphicsElement;
          const box = path.getBBox(), cell = rect.getBBox(), matrix = path.transform.baseVal.consolidate()!.matrix;
          const stroke = parseFloat(getComputedStyle(path).strokeWidth) / 2;
          return { shape: path.getAttribute("d"), contained: box.x + matrix.e - stroke >= cell.x && box.x + box.width + matrix.e + stroke <= cell.x + cell.width && box.y + matrix.f - stroke >= cell.y && box.y + box.height + matrix.f + stroke <= cell.y + cell.height };
        }));
        expect(symbols.every((symbol) => symbol.shape === legendPath && symbol.contained), `${width}px ${floor}`).toBe(true);
      }
    }
  });
  test("I科棟の階段位置を保ち、棟の接続は線ではなく説明で伝える", async ({ page }) => {
    for (const [floor, stairsRange] of [["1F", "F10"], ["2F", "F5"]]) {
      await page.goto(`/map/exhibition/?floor=${floor}`);
      const figure = page.locator(`[data-floor-panel='${floor}'] .indoor-map`);
      const building = figure.locator("[data-building-diagram='I科棟']");
      await expect(building.locator(`[data-room='階段'][data-source-range='${stairsRange}'] rect`)).toHaveCount(1);
      await expect(building.locator("[data-room='階段'] rect")).toHaveCount(1);
      const stairs = building.locator(`[data-source-range='${stairsRange}'] [data-stairs-symbol]`);
      await expect(stairs).toHaveCount(1);
      expect(await stairs.evaluate((node) => {
        const path = node as SVGGraphicsElement;
        const rect = path.previousElementSibling as SVGGraphicsElement;
        const box = path.getBBox(), cell = rect.getBBox(), matrix = path.transform.baseVal.consolidate()!.matrix;
        return box.x + matrix.e >= cell.x && box.x + box.width + matrix.e <= cell.x + cell.width && box.y + matrix.f >= cell.y && box.y + box.height + matrix.f <= cell.y + cell.height;
      })).toBe(true);
      await expect(figure.locator("figcaption")).toContainText("C科棟とI科棟は通路でつながっています");
      const connection = figure.locator("[data-building-connection='I科棟-C科棟']");
      await expect(connection).toHaveCount(0);
      await expect(figure.locator("svg desc")).toContainText("C科棟とI科棟は通路でつながっています");
      await expect(figure.locator("figcaption")).toContainText("I科棟の階段は接続通路の横です");
    }
    await page.goto("/map/exhibition/?floor=1F");
    const first = page.locator("[data-floor-panel='1F'] [data-building-diagram='I科棟']");
    for (const range of ["K8:L8", "I10:J10", "K10:L10"]) await expect(first.locator(`[data-source-range='${range}'] rect`)).toHaveCount(1);
    await page.goto("/map/exhibition/?floor=3F");
    await expect(page.locator("[data-floor-panel='3F'] [data-building-connection]")).toHaveCount(0);
  });
  test("Excelの用途は企画IDがなくても教室案内に残す", async ({ page }) => {
    await page.goto("/map/exhibition/");
    const first = page.locator("[data-floor-panel='1F']");
    for (const name of ["ダイソウ", "飲食スペース", "自衛隊展示"]) await expect(first).toContainText(name);
    await page.getByRole("tab", { name: "2F", exact: true }).click();
    const second = page.locator("[data-floor-panel='2F']");
    await expect(second).toContainText("課題研究");
    await expect(second).toContainText("専攻科展示");
    await page.getByRole("tab", { name: "3F", exact: true }).click();
    await expect(page.locator("[data-floor-panel='3F']")).toContainText("中勢自動車");
  });
  test("更新版Excelの実験室と区画を描き、通路を教室として閉じない", async ({ page }) => {
    await page.goto("/map/exhibition/?floor=2F");
    const building = page.locator("[data-floor-panel='2F'] [data-building-diagram='I科棟']");
    await expect(building.locator("[data-source-range='G3:H3'] rect")).toHaveCount(1);
    await expect(building.locator("[data-source-range='I3'] rect")).toHaveCount(1);
    await expect(building.locator("[data-source-range='J3:L4'][data-room='電子情報工学実験室'] rect")).toHaveCount(1);
    await expect(building.locator("[data-source-range='I5:L5'] rect")).toHaveCount(0);
  });
  test("校内図の教室コードが区画からはみ出さず、狭幅と文字拡大でも一覧を読める", async ({ page }) => {
    for (const width of [375, 320, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/map/exhibition/");
      await page.evaluate(() => document.fonts.ready);
      for (const floor of ["1F", "2F", "3F"]) {
        await page.getByRole("tab", { name: floor, exact: true }).click();
        const panel = page.locator(`[data-floor-panel='${floor}']`);
        const clipped = await panel.locator(".indoor-map .room-code").evaluateAll((codes) => codes.filter((code) => {
          const rect = code.previousElementSibling!;
          const x = Number(rect.getAttribute("x")), y = Number(rect.getAttribute("y"));
          const width = Number(rect.getAttribute("width")), height = Number(rect.getAttribute("height"));
          const box = (code as SVGGraphicsElement).getBBox();
          return box.x < x - .5 || box.x + box.width > x + width + .5 || box.y < y - .5 || box.y + box.height > y + height + .5;
        }).map((code) => code.textContent));
        expect(clipped, `${width}px ${floor}`).toEqual([]);
      }
      await page.evaluate(() => {
        const sizes = [...document.querySelectorAll<HTMLElement>("main h1,main h3,main h4,main p,main figcaption,main a,main strong,main small,main span,main button")].map((el) => [el, parseFloat(getComputedStyle(el).fontSize)] as const);
        sizes.forEach(([el, size]) => { el.style.fontSize = `${size * 2}px`; });
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
  });
  test("確認済み企画をExcelの教室配置に対応させ、共用室もまとめて案内する", async ({ page }) => {
    await page.goto("/map/exhibition/");
    const panel = page.locator("[data-floor-panel='1F']");
    const map = panel.locator(".indoor-map");
    await expect(map.getByRole("group", { name: "1Fの教室配置図", exact: true })).toBeVisible();
    const iBuilding = map.locator("[data-building-diagram='I科棟']");
    const cBuilding = map.locator("[data-building-diagram='C科棟']");
    expect((await iBuilding.boundingBox())!.x).toBeLessThan((await cBuilding.boundingBox())!.x);
    for (const room of ["1M", "1E", "1I", "第二合併講義室", "第一合併講義室"]) {
      await expect(cBuilding.locator(`[data-room='${room}']`)).toHaveCount(1);
    }
    await expect(iBuilding.locator("[data-room='3C']")).toHaveCount(1);
    const shared = panel.locator("[data-room-list='C:1F:1E']");
    await expect(shared.locator("a[href='/entry/rec-robocon/']")).toBeVisible();
    await expect(shared.locator("a[href='/entry/rec-shashin/']")).toBeVisible();
    await page.getByRole("tab", { name: "2F" }).click();
    const second = page.locator("[data-floor-panel='2F']");
    const researchRoom = second.locator("[data-room-list='C:2F:1S']");
    await expect(researchRoom.locator("a[href='/entry/rec-wandervogel/']")).toBeVisible();
    await expect(researchRoom.locator("a[href='/entry/rec-kyokotsu-appaku/']")).toContainText("C科棟 2F・1S");
    await expect(researchRoom.locator("a")).toHaveCount(2);
    await expect(researchRoom).not.toContainText("確認中");
    await expect(second.locator("[data-room-list='I:2F:5I'] a[href='/entry/rec-1a/']")).toContainText("I科棟 2F・5I");
    await expect(second.locator("[data-room-list='I:2F:5I']")).toContainText("専攻科展示");
    const workshop = second.locator("[data-room-list='I:2F:電子情報工学実験室'] a[href='/entry/workshop-ai-sorting-robot/']");
    await expect(workshop).toContainText("I科棟 2F・電子情報工学実験室");
    await expect(second.locator("[data-unplaced-entries]")).toHaveCount(0);
    await workshop.click();
    await expect(page).toHaveURL(/\/entry\/workshop-ai-sorting-robot\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("AI×工作ワークショップ");
    await page.goBack();
    await expect(page.getByRole("tab", { name: "2F" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "3F" }).click();
    const third = page.locator("[data-floor-panel='3F']");
    await expect(third.locator(".indoor-map [data-room='第三合併講義室']")).toHaveCount(1);
    await expect(third.locator(".indoor-map [data-building-diagram='I科棟']")).toHaveCount(0);
    await third.locator("a[href='/entry/rec-kagaku-magic/']").click();
    await expect(page).toHaveURL(/\/entry\/rec-kagaku-magic\/$/);
    await page.goBack();
    await expect(page.getByRole("tab", { name: "3F" })).toHaveAttribute("aria-selected", "true");
  });
  test("図の範囲外のプラザへ、行き方と会場案内を読んで進める", async ({ page }) => {
    await page.goto("/map/");
    const link = page.getByRole("link", { name: "イノベーション交流プラザへの行き方" });
    await link.click();
    await expect(page).toHaveURL(/\/map\/innovation-plaza\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("イノベーション交流プラザ");
    const figure = page.locator(".plaza-route");
    await expect(figure.getByRole("img")).toBeVisible();
    await expect.poll(() => figure.locator("img").evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await expect(page.locator(".route-steps li")).toHaveCount(3);
    await expect(page.locator(".route-steps")).toContainText("テニスコート");
    await expect(page.locator(".route-steps")).toContainText("寮と学食の間");
    await expect(page.locator("main")).toContainText("2F サイエンス教育支援室");
    await expect(page.locator("main a[href='/entry/workshop-drone/']")).toBeVisible();
    await page.getByRole("link", { name: "← MAPに戻る" }).first().click();
    await expect(page).toHaveURL(/\/map\/$/);
  });
  test("プラザの補助図と道順はスマホ・文字拡大・JSなしでも読める", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await page.goto("http://localhost:4325/map/innovation-plaza/");
    await expect(page.locator(".route-steps li")).toHaveCount(3);
    await expect(page.locator("main a[href='/entry/workshop-drone/']")).toBeVisible();
    // JS無効のページではstyleのloadイベントが発火せずaddStyleTagが待ち続けるため、
    // 検査用の文字拡大はDOMへ直接挿入する。サイトのスクリプトは有効にしない。
    await page.evaluate(() => {
      const style = document.createElement("style");
      style.textContent = ".route-steps, .plaza-note { font-size: 200% !important; }";
      document.head.appendChild(style);
    });
    for (const width of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await expect(page.locator(".plaza-route img")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${width}px横スクロール`).toBeLessThanOrEqual(1);
    }
    await context.close();
  });
  test("人間が配置した4つのエリア札を図と一覧で同じ案内につなぐ", async ({ page }) => {
    await page.goto("/map/");
    await expect(page.getByRole("heading", { name: "会場マップ", exact: true })).toBeVisible();
    await expect(page.locator(".campus-art img")).toHaveCount(31);
    await expect.poll(() => page.locator(".campus-art img").evaluateAll((els) => els.every((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await expect(page.locator(".map-area-list > li")).toHaveCount(4);
    await expect(page.locator(".campus-map .area-label")).toHaveCount(4);
    for (const code of ["01", "02", "03", "04"]) {
      const diagram = page.locator(`.campus-map [data-area='${code}']`);
      const list = page.locator(`.map-area-list [data-area='${code}']`);
      expect(await diagram.getAttribute("href")).toBe(await list.getAttribute("href"));
      const box = await diagram.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("01と03の地図札から案内へ進み、戻って同じ札を使える", async ({ page }) => {
    await page.goto("/map/");
    await page.locator(".campus-map [data-area='01']").click();
    await expect(page).toHaveURL(/\/map\/food\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("飲食バザー");
    await expect(page.locator(".bazaar-map")).toBeVisible();
    await page.goBack();
    await expect(page.locator(".campus-map [data-area='01']")).toBeVisible();
    await page.locator(".campus-map [data-area='03']").click();
    await expect(page).toHaveURL(/\/map\/game\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goBack();
    await expect(page.locator(".campus-map [data-area='03']")).toBeVisible();
  });
  test("地図だけでエリアとステージの名称を読めて、札同士を押し間違えない", async ({ page }) => {
    const expected = [["01", "飲食バザー"], ["02", "展示・レク"], ["03", "ゲームイベント"], ["04", "学科展示 ←"]];
    for (const width of [375, 320, 600, 768, 899, 900, 1024, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/map/");
      await page.evaluate(() => document.fonts.ready);
      for (const [code, name] of expected) {
        const label = page.locator(`.campus-map [data-area='${code}'] .area-name`);
        await expect(label).toBeVisible();
        await expect(label).toHaveText(name);
      }
      for (const name of ["LiveStage", "MainStage", "SubStage"]) await expect(page.locator(`.campus-map [data-stage-name='${name}']`)).toHaveText(name);
      const result = await page.locator(".campus-map").evaluate((map) => {
        const frame = map.getBoundingClientRect();
        const boxes = [...map.querySelectorAll("a")].map((el) => ({ name: el.getAttribute("aria-label"), b: el.getBoundingClientRect() }));
        const clippedText = [...map.querySelectorAll(".area-name")].filter((el) => {
          const anchor = el.closest("a")!;
          const link = anchor.getBoundingClientRect();
          const range = document.createRange(); range.selectNodeContents(el);
          return [...range.getClientRects()].some((b) => b.left < link.left - 1 || b.right > link.right + 1 || b.top < link.top - 1 || b.bottom > link.bottom + 1);
        }).map((el) => el.textContent);
        return {
          clippedText,
          stageHidden: (() => {
            const art = map.querySelector(".art-piece[data-node-id='1005:235']")!.getBoundingClientRect();
            const x = art.left + art.width / 2, y = art.top + art.height / 2;
            return [...map.querySelectorAll(".label-paper")].some((el) => {
              const b = el.getBoundingClientRect();
              return x > b.left && x < b.right && y > b.top && y < b.bottom;
            });
          })(),
          tooSmall: boxes.filter(({ b }) => b.width < 44 || b.height < 44).map(({ name }) => name),
          collisions: boxes.flatMap((a, i) => boxes.slice(i + 1).filter(({ b }) => a.b.left < b.right && a.b.right > b.left && a.b.top < b.bottom && a.b.bottom > b.top).map((b) => [a.name, b.name])),
          // スマホ幅の棟の名札は建物の中心にそろえるため、図の右端からページ余白へはみ出してよい（横スクロールは scroll で見る）。
          outside: boxes.filter(({ name, b }) => !(name?.startsWith("マルチメディア棟") && frame.width <= 680) && (b.left < frame.left - 1 || b.right > frame.right + 1 || b.top < frame.top - 1 || b.bottom > frame.bottom + 1)).map(({ name }) => name),
          scroll: document.documentElement.scrollWidth - innerWidth,
        };
      });
      expect(result.clippedText, `${width}px 名称の切れ`).toEqual([]);
      expect(result.stageHidden, `${width}px ステージの目印を札が隠さない`).toBe(false);
      expect(result.tooSmall, `${width}px 44px未満の操作札`).toEqual([]);
      expect(result.collisions, `${width}px 札の操作領域の重なり`).toEqual([]);
      expect(result.outside, `${width}px 札の図外へのはみ出し`).toEqual([]);
      expect(result.scroll, `${width}px 横スクロール`).toBeLessThanOrEqual(1);
    }
  });
  test("スマホ幅では02・03の札を校舎の屋根の幅に収め、屋根より上にはみ出さない", async ({ page }) => {
    for (const width of [320, 340, 360, 375, 414, 600, 899]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/map/");
      await page.evaluate(() => document.fonts.ready);
      const result = await page.locator(".campus-map").evaluate((map) => {
        const art = map.querySelector("[data-node-id='1005:113']")!.getBoundingClientRect();
        // school-blue.png（1538×664）の青い屋根は x 19〜1463、y 92〜。
        const roof = { left: art.left + art.width * 19 / 1538, right: art.left + art.width * 1463 / 1538, top: art.top + art.height * 92 / 664, bottom: art.bottom };
        return ["02", "03"].map((code) => {
          const b = map.querySelector(`[data-area='${code}'] .label-paper`)!.getBoundingClientRect();
          return { code, inside: b.left >= roof.left && b.right <= roof.right && b.top >= roof.top && b.bottom <= roof.bottom };
        });
      });
      for (const { code, inside } of result) expect(inside, `${width}px ${code}の札が校舎に収まる`).toBe(true);
    }
  });

  test("MainStageの絵を番号札で隠さない", async ({ page }) => {
    for (const width of [375, 320, 600, 768, 899, 900, 1024, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/map/");
      await page.evaluate(() => document.fonts.ready);
      const coveringLabels = await page.locator(".campus-map").evaluate((map) => {
        const stage = map.querySelector(".art-piece[data-node-id='1005:235']")!.getBoundingClientRect();
        return [...map.querySelectorAll(".label-paper")].filter((el) => {
          const b = el.getBoundingClientRect();
          // 半ピクセル以内の接触は描画時の丸めとして許容する。
          return Math.min(b.right, stage.right) - Math.max(b.left, stage.left) > 0.5
            && Math.min(b.bottom, stage.bottom) - Math.max(b.top, stage.top) > 0.5;
        }).map((el) => el.textContent);
      });
      expect(coveringLabels, `${width}px MainStageの絵を覆う札`).toEqual([]);
    }
  });

  test("マルチメディア棟の名札を建物の中心・正面の下側に重ね、屋根を隠さずに案内へ進める", async ({ page }) => {
    for (const width of [375, 320, 600, 768, 899, 900, 1024, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/map/");
      await page.evaluate(() => document.fonts.ready);
      const label = page.locator(".campus-map [data-venue='multimedia']");
      await expect(label).toHaveText("マルチメディア棟");
      const result = await label.evaluate((anchor) => {
        const map = anchor.closest(".campus-map")!;
        const art = map.querySelector("[data-node-id='1279:2196']")!.getBoundingClientRect();
        const plate = anchor.querySelector(".name-plate")!.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(anchor.querySelector(".name-plate")!);
        // 番号札は棟の絵に掛からない（名札だけを重ねる）。
        const coveringLabels = [...map.querySelectorAll(".label-paper")].filter((el) => {
          const b = el.getBoundingClientRect();
          return Math.min(b.right + 2, art.right) - Math.max(b.left, art.left) > 0.5 && Math.min(b.bottom + 2, art.bottom) - Math.max(b.top, art.top) > 0.5;
        }).map((el) => el.textContent);
        const center = (plate.left + plate.right) / 2 - (art.left + art.width * 240.5 / 486);
        return { belowRoof: plate.top >= art.top + art.height * 0.5, onArt: plate.top < art.bottom, center,
          scroll: document.documentElement.scrollWidth - innerWidth, inViewport: plate.left >= 0 && plate.right <= innerWidth,
          // 欠けは横方向で見る（縦はフォントの上下余白が行の高さを超えるだけで、文字は切れない）。
          clipped: [...range.getClientRects()].some((b) => b.left < plate.left - 0.5 || b.right > plate.right + 0.5),
          coveringLabels };
      });
      expect(result.belowRoof, `${width}px 屋根を隠さない`).toBe(true);
      expect(Math.abs(result.center), `${width}px 名札の中心が建物の中心にそろう`).toBeLessThanOrEqual(1);
      expect(result.inViewport, `${width}px 名札が画面内に収まる`).toBe(true);
      expect(result.scroll, `${width}px 横スクロール`).toBeLessThanOrEqual(1);
      expect(result.onArt, `${width}px 名札が棟の正面に重なる`).toBe(true);
      expect(result.clipped, `${width}px 正式名称の欠け`).toBe(false);
      expect(result.coveringLabels, `${width}px マルチメディア棟を覆う番号札`).toEqual([]);
    }
    await page.locator(".campus-map [data-venue='multimedia']").click();
    await expect(page).toHaveURL(/\/map\/multimedia\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("マルチメディア棟");
  });

  test("不要になった専攻科棟は図と案内から外し、ほかの会場は残す", async ({ page, request }) => {
    await page.goto("/map/");
    await expect(page.locator("main")).not.toContainText("専攻科");
    await expect(page.locator(".campus-art [data-node-id='1297:2532']")).toHaveCount(0);
    await expect(page.locator("main a[href='/map/advanced-course/']")).toHaveCount(0);
    for (const key of ["multimedia", "headquarters"]) {
      await expect(page.locator(`.campus-map [data-venue='${key}']`)).toBeVisible();
    }
    expect((await request.get("/map/advanced-course/")).status()).toBe(404);
  });
  test("フードとスイーツの番号を分けて案内し、配置図を利用できる", async ({ page }) => {
    await page.goto("/map/");
    await page.locator(".map-area-list [data-area='01']").click();
    await expect(page).toHaveURL(/\/map\/food\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("飲食バザー");
    await expect(page.locator("main")).not.toContainText("詳細配置は準備中");
    await expect(page.locator(".bazaar-map")).toBeVisible();
    await expect(page.locator("[data-stall-group='food'] a")).toHaveCount(12);
    await expect(page.locator("[data-stall-group='sweets'] a")).toHaveCount(10);
    // 配布用マップのスイーツ9（茶道部）は図の範囲外のマルチメディア棟。一覧にだけ場所付きで載せる。
    const tea = page.locator("[data-stall-group='sweets'] a[href='/entry/food-sado/']");
    await expect(tea.locator(".stall-badge")).toHaveText(/スイーツ\s*9/);
    await expect(tea).toContainText("マルチメディア棟1F");
    await expect(page.locator(".bazaar-map a[href='/entry/food-sado/']")).toHaveCount(0);
    await page.goto("/map/multimedia/");
    await expect(page.locator("main a[href='/entry/food-sado/'] .stall-badge")).toHaveText(/スイーツ\s*9/);
    await page.goto("/map/food/");
    await expect(page.locator("[data-stall-group='food'] a[href='/entry/food-5e/']")).toContainText("0");
    await expect(page.locator("[data-stall-group='sweets'] a[href='/entry/food-volleyball/']")).toContainText("8");
    await expect(page.locator("main a[href='/entry/food-basketball/']")).toHaveCount(0);
    await expect(page.locator("main a[href='/map/multimedia/']")).toBeVisible();
  });
  test("出店中止のみたらし団子は一覧と詳細に掲載しない", async ({ page, request }) => {
    await page.goto("/booth/");
    // 個別公開日前のカードはリンクではなく文章として表示される。
    await expect(page.locator("main")).toContainText("ベーコンチーズ巻");
    await expect(page.locator("main")).not.toContainText("みたらし団子");
    await expect(page.locator("main a[href='/entry/food-basketball/']")).toHaveCount(0);
    expect((await request.get("/entry/food-basketball/")).status()).toBe(404);
  });
  test("飲食バザーは屋台の位置を番号付きの図で示し、一覧と同じ札で対応させる", async ({ page }) => {
    await page.goto("/map/food/");
    const map = page.locator(".bazaar-map");
    await expect(map.locator("img").first()).toBeVisible();
    await expect.poll(() => map.locator("img").evaluateAll((els) => els.every((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await expect(map.locator(".stall-badge[data-group='food']")).toHaveCount(12);
    await expect(map.locator(".stall-badge[data-group='sweets']")).toHaveCount(9);
    // 凡例と一覧も、図と同じ札でフードとスイーツを見分けられる
    await expect(page.locator(".bazaar-legend .stall-badge")).toHaveCount(2);
    await expect(page.locator("[data-stall-group='food'] a .stall-badge[data-group='food']")).toHaveCount(12);
    await expect(page.locator("[data-stall-group='sweets'] a .stall-badge[data-group='sweets']")).toHaveCount(10);
    await expect(page.locator("[data-stall-group='food'] a[href='/entry/food-5e/'] .stall-badge")).toHaveText(/フード\s*0/);
    // 色だけに頼らず、形でも区別する
    const shape = (group: string) => map.locator(`.stall-badge[data-group='${group}']`).first().evaluate((el) => getComputedStyle(el).borderRadius);
    expect(await shape("food")).not.toBe(await shape("sweets"));

    for (const width of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      const result = await map.evaluate((root) => {
        const frame = root.getBoundingClientRect();
        const boxes = [...root.querySelectorAll(".stall-badge")].map((el) => ({ text: el.textContent, b: el.getBoundingClientRect() }));
        const collisions = boxes.flatMap((a, i) => boxes.slice(i + 1).filter(({ b }) => a.b.left < b.right && a.b.right > b.left && a.b.top < b.bottom && a.b.bottom > b.top).map((b) => [a.text, b.text]));
        const outside = boxes.filter(({ b }) => b.left < frame.left - 1 || b.right > frame.right + 1 || b.top < frame.top - 1 || b.bottom > frame.bottom + 1).map(({ text }) => text);
        return { collisions, outside, scroll: document.documentElement.scrollWidth - innerWidth };
      });
      expect(result.collisions, `${width}px 札の重なり`).toEqual([]);
      expect(result.outside, `${width}px 図からはみ出す札`).toEqual([]);
      expect(result.scroll, `${width}px 横スクロール`).toBeLessThanOrEqual(1);
    }
  });

  test("飲食バザーの番号札は対応する屋台の詳細へ進み、戻って別の番号を選べる", async ({ page }) => {
    await page.goto("/map/food/");
    const map = page.locator(".bazaar-map");
    const expected = [
      ["フード", "0", "food-5e"], ["フード", "1", "food-5m"],
      ["フード", "2", "food-5c"], ["フード", "3", "food-takkyu"],
      ["フード", "4", "food-baseball"], ["フード", "5", "food-rugby"],
      ["フード", "6", "food-ecocar"], ["フード", "7", "food-soft-tennis"],
      // 2026-10-13 配布用マップの番号と団体
      ["フード", "8", "food-koshiki-tennis"], ["フード", "9", "food-ongaku"],
      ["フード", "10", "food-karate"], ["フード", "11", "food-yosakoi"],
      ["スイーツ", "0", "food-handball"], ["スイーツ", "1", "food-kyudo"],
      ["スイーツ", "2", "food-rikujo"], ["スイーツ", "3", "food-badminton"],
      ["スイーツ", "4", "food-shashin"], ["スイーツ", "5", "food-soccer"],
      ["スイーツ", "6", "food-procon"], ["スイーツ", "7", "food-kendo"],
      ["スイーツ", "8", "food-volleyball"],
    ];
    await expect(map.getByRole("link")).toHaveCount(21);
    for (const [group, code, id] of expected) {
      await expect(map.getByRole("link", { name: new RegExp(`^${group}${code} `) })).toHaveAttribute("href", `/entry/${id}/`);
    }
    // 校舎（赤）の下の2段は、配布用マップと同じくフードとスイーツが混ざって並ぶ。
    const rows = await map.evaluate((root) => {
      const pins = [...root.querySelectorAll("a")].map((a) => { const b = a.getBoundingClientRect(); return { name: a.getAttribute("aria-label")!.split(" ")[0], x: b.left, y: b.top + b.height / 2 }; });
      const sorted = pins.sort((a, b) => a.y - b.y);
      const grouped: { y: number; names: { name: string; x: number }[] }[] = [];
      for (const pin of sorted) {
        const row = grouped.find((item) => Math.abs(item.y - pin.y) < 5);
        if (row) row.names.push(pin); else grouped.push({ y: pin.y, names: [pin] });
      }
      return grouped.map((row) => row.names.sort((a, b) => a.x - b.x).map((pin) => pin.name));
    });
    expect(rows.at(-2)).toEqual(["フード8", "スイーツ0", "スイーツ1", "フード9", "スイーツ2"]);
    expect(rows.at(-1)).toEqual(["フード10", "スイーツ3", "フード11", "スイーツ4", "スイーツ5"]);
    await map.getByRole("link", { name: /^フード0 / }).click();
    await expect(page).toHaveURL(/\/entry\/food-5e\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ベーコンチーズ巻");
    await page.goBack();
    await map.getByRole("link", { name: /^スイーツ0 / }).click();
    await expect(page).toHaveURL(/\/entry\/food-handball\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("チュロス");
    await page.goBack();
    const lastFood = map.getByRole("link", { name: /^フード11 / });
    await lastFood.focus();
    await expect(lastFood).toBeFocused();
    expect(await lastFood.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/entry\/food-yosakoi\/$/);
  });

  test("屋台番号の図は横スクロールせず全体を見渡せて、JSなしでも詳細へ進める", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await page.goto("http://localhost:4325/map/food/");
    const map = page.locator(".bazaar-map");
    await expect(map.getByRole("link")).toHaveCount(21);
    for (const width of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      const result = await map.evaluate((root) => {
        const frame = root.getBoundingClientRect();
        const boxes = [...root.querySelectorAll("a")].map((el) => ({ name: el.getAttribute("aria-label"), b: el.getBoundingClientRect() }));
        return {
          tooSmall: boxes.filter(({ b }) => b.width < 24 || b.height < 24).map(({ name }) => name),
          fitsViewport: frame.left >= 0 && frame.right <= innerWidth + 1,
          hiddenHorizontally: boxes.filter(({ b }) => b.left < 0 || b.right > innerWidth + 1).map(({ name }) => name),
          collisions: boxes.flatMap((a, i) => boxes.slice(i + 1).filter(({ b }) => a.b.left < b.right && a.b.right > b.left && a.b.top < b.bottom && a.b.bottom > b.top).map((b) => [a.name, b.name])),
          outside: boxes.filter(({ b }) => b.left < frame.left - 1 || b.right > frame.right + 1 || b.top < frame.top - 1 || b.bottom > frame.bottom + 1).map(({ name }) => name),
          scroll: document.documentElement.scrollWidth - innerWidth,
        };
      });
      expect(result.tooSmall, `${width}px 操作範囲`).toEqual([]);
      expect(result.fitsViewport, `${width}px 図全体が画面幅内に収まる`).toBe(true);
      expect(result.hiddenHorizontally, `${width}px 横スクロールなしで番号を見渡せる`).toEqual([]);
      expect(result.collisions, `${width}px リンクの重なり`).toEqual([]);
      expect(result.outside, `${width}px リンクのはみ出し`).toEqual([]);
      expect(result.scroll, `${width}px 横スクロール`).toBeLessThanOrEqual(1);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await map.getByRole("link", { name: /^スイーツ8 / }).click();
    await expect(page).toHaveURL(/\/entry\/food-volleyball\/$/);
    await context.close();
  });

  test("全体MAPには案内を積まず、各案内は別ページで読んで戻れる", async ({ page }) => {
    await page.goto("/map/");
    // 全体MAPは地図と一覧だけ。05も教室の図を確認してから詳細へ進む。
    await expect(page.locator("main a[href^='/entry/']")).toHaveCount(0);
    await expect(page.locator("main details")).toHaveCount(0);
    // 棟・本部は地図上の札から案内し、地図の下に一覧を重ねない
    await expect(page.getByRole("heading", { name: "棟・本部の案内" })).toHaveCount(0);
    for (const key of ["multimedia", "headquarters"]) {
      await expect(page.locator(`.campus-map [data-venue='${key}']`)).toHaveAttribute("href", `/map/${key}/`);
    }
    // 屋台の番号は小さくて読めないので地図に載せず、飲食バザーのページで案内する
    await expect(page.locator(".campus-map")).not.toContainText(/フード|スイーツ/);
    await expect(page.locator(".stall-label")).toHaveCount(0);

    // 案内ページは全体MAPと同じ公開状態なので、MAPが見えているのに「リンク先は準備中」とは出さない
    await expect(page.locator(".map-area-list [data-area='01']")).toContainText("店舗と番号を見る");
    await expect(page.locator(".map-area-list [data-area='02']")).toContainText("棟・階の案内を見る");

    await page.locator(".map-area-list [data-area='02']").click();
    await expect(page).toHaveURL(/\/map\/exhibition\/$/);
    await expect(page.locator("main")).toContainText("教室配置図");
    await page.getByRole("tab", { name: "3F" }).click();
    await expect(page.locator("main a[href='/entry/rec-kagaku-magic/']")).toContainText("C科棟 3F・第三合併講義室");
    await page.getByRole("link", { name: "← MAPに戻る" }).first().click();
    await expect(page).toHaveURL(/\/map\/$/);

    await page.locator(".campus-map [data-venue='multimedia']").click();
    await expect(page.locator("main")).toContainText("入ってすぐ左側");
    await expect(page.locator("main a[href='/entry/food-sado/']")).toBeVisible();
    await expect(page.locator("main a[href='/entry/rec-kado/']")).toBeVisible();
    const consultation = page.locator("main .entry-row").filter({ hasText: "中学生向け受験相談" });
    await expect(consultation).toBeVisible();
    await expect(consultation.locator("xpath=self::a")).toHaveCount(0);
    await page.getByRole("link", { name: "← MAPに戻る" }).first().click();
    await expect(page).toHaveURL(/\/map\/$/);

    await page.locator(".campus-map [data-venue='headquarters']").click();
    await expect(page.locator("main")).toContainText("ガチャガチャ");
    await expect(page.locator("main")).toContainText("結果発表はMainStage");

  });

  test("展示・レクは階を切り替えて、その階の企画を棟ごとに読める", async ({ page }) => {
    await page.goto("/map/exhibition/");
    const exhibition = page.locator("main");
    const tabs = exhibition.getByRole("tab");
    await expect(tabs).toHaveText(["1F", "2F", "3F"]);
    await expect(exhibition.getByRole("tab", { name: "1F" })).toHaveAttribute("aria-selected", "true");
    await expect(exhibition.locator("a[href='/entry/rec-robocon/']")).toBeVisible();
    await expect(exhibition.locator("a[href='/entry/rec-kagaku-magic/']")).toBeHidden();
    await expect(exhibition.locator("a[href='/entry/rec-procon/']")).toBeHidden();

    await exhibition.getByRole("tab", { name: "2F" }).click();
    await expect(page).toHaveURL(/\?floor=2F$/);
    await expect(exhibition.getByRole("tab", { name: "2F" })).toHaveAttribute("aria-selected", "true");
    await expect(exhibition.getByRole("tab", { name: "1F" })).toHaveAttribute("aria-selected", "false");
    const second = exhibition.getByRole("tabpanel", { name: "2F" });
    await expect(second).toBeVisible();
    await expect(exhibition.locator("a[href='/entry/rec-kagaku-magic/']")).toBeHidden();
    // 同じ階でも棟が違えば別のまとまりにする
    await expect(second.locator("[data-building='C科棟'] a[href='/entry/rec-procon/']")).toBeVisible();
    await expect(second.locator("[data-building='I科棟'] a[href='/entry/rec-1a/']")).toBeVisible();
    await expect(second.locator("[data-building='I科棟'] a[href='/entry/workshop-ai-sorting-robot/']")).toContainText("電子情報工学実験室");
    // 05のゲーム会場も1Fの教室別一覧で確認できる。
    await expect(exhibition.locator("a[href='/entry/game-tournament/']")).toHaveCount(gameHidden ? 0 : 1);

    await exhibition.getByRole("tab", { name: "2F" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(exhibition.getByRole("tab", { name: "3F" })).toBeFocused();
    await expect(exhibition.getByRole("tab", { name: "3F" })).toHaveAttribute("aria-selected", "true");
    await expect(exhibition.locator("a[href='/entry/rec-rigaku/']")).toBeVisible();
    await expect(exhibition.locator("a[href='/entry/rec-kagaku-magic/']")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(exhibition.getByRole("tab", { name: "1F" })).toBeFocused();

    // URLで階を指定して開ける（共有・戻るで同じ階になる）
    await page.goto("/map/exhibition/?floor=3F");
    await expect(exhibition.getByRole("tab", { name: "3F" })).toHaveAttribute("aria-selected", "true");
  });

  test("教室配置の正本で対応が判明した企画を、正しい棟・階・教室で案内する", async ({ page }) => {
    // Excel正本のセルから手で照合した期待値。runtimeのmap.jsonから生成しない。
    const expected = [
      ["rec-bijutsu", "I科棟", "1F", "3C"],
      ["rec-robocon", "C科棟", "1F", "1E"],
      ["rec-shashin", "C科棟", "1F", "1E"],
      ["rec-ongaku", "C科棟", "1F", "1I"],
      ["rec-ecocar", "C科棟", "1F", "1M"],
      ["rec-seibutsu", "C科棟", "2F", "2M"],
      ["rec-gcon", "C科棟", "2F", "2E"],
      ["rec-procon", "C科棟", "2F", "2I"],
      ["rec-wandervogel", "C科棟", "2F", "1S"],
      ["rec-douga", "C科棟", "3F", "2C"],
      ["rec-5i", "C科棟", "3F", "2S"],
      ["rec-2a", "C科棟", "3F", "2S"],
      ["rec-suiei", "C科棟", "3F", "3S"],
      ["rec-rigaku", "C科棟", "3F", "4S"],
      ["rec-kanko", "C科棟", "3F", "4S"],
      ["rec-kagaku-magic", "C科棟", "3F", "第三合併講義室"],
    ];
    await page.goto("/map/exhibition/");
    for (const floor of ["1F", "2F", "3F"]) {
      await page.getByRole("tab", { name: floor, exact: true }).click();
      const panel = page.getByRole("tabpanel", { name: floor, exact: true });
      for (const [id, building, , room] of expected.filter(([, , f]) => f === floor)) {
        const link = panel.locator(`[data-building='${building}'] a[href='/entry/${id}/']`);
        await expect(link).toBeVisible();
        // 団体名を分けると確定した3件だけを併記。ほかの表示は維持する。
        const group = ({ "rec-douga": "動画同好会", "rec-5i": "5I", "rec-suiei": "水泳部" } as Record<string, string>)[id];
        await expect(link.locator("small")).toHaveText(`${group ? `${group}／` : ""}${building} ${floor}・${room}`);
        await expect(page.locator(`main a[href='/entry/${id}/']`)).toHaveCount(1);
      }
    }
    // 追加確認された3企画も、教室名付きで一度だけ案内する。
    await page.getByRole("tab", { name: "2F", exact: true }).click();
    for (const [id, location] of [
      ["rec-kyokotsu-appaku", "C科棟 2F・1S"],
      ["rec-1a", "I科棟 2F・5I"],
      ["workshop-ai-sorting-robot", "I科棟 2F・電子情報工学実験室"],
    ]) {
      const link = page.locator(`main a[href='/entry/${id}/']`);
      await expect(link).toBeVisible();
      await expect(link.locator("small")).toHaveText(location);
      await expect(link).toHaveCount(1);
    }
    await expect(page.locator("main a[href='/entry/game-tournament/']")).toHaveCount(gameHidden ? 0 : 1);
  });

  test("ゲーム大会が非公開の間は、03を準備中にして大会情報と教室のリンクを出さない", async ({ page }) => {
    test.skip(!gameHidden, "ゲーム大会は公開中");
    await page.goto("/map/");
    await expect(page.locator(".campus-map [data-area='03']")).toHaveAttribute("aria-label", /遷移先は準備中/);
    await expect(page.locator(".map-area-list [data-area='03']")).toContainText("リンク先は準備中");
    await page.goto("/map/game/");
    await expect(page.locator("main .preparing")).toBeVisible();
    await expect(page.locator("#game-info")).toHaveCount(0);
    await page.goto("/map/exhibition/?floor=1F");
    await expect(page.locator("[data-floor-panel='1F'] a[href='/entry/game-tournament/']")).toHaveCount(0);
    await expect(page.locator("[data-floor-panel='1F'] .indoor-map a[data-room='第二合併講義室']")).toHaveCount(0);
  });

  test("正本で3Fに訂正した化学マジックは詳細へ進んで同じ階へ戻れる", async ({ page }) => {
    await page.goto("/map/exhibition/?floor=3F");
    const link = page.locator("main a[href='/entry/rec-kagaku-magic/']");
    await expect(link).toBeVisible();
    await expect(link).toContainText("C科棟 3F・第三合併講義室");
    await link.click();
    await expect(page).toHaveURL(/\/entry\/rec-kagaku-magic\/$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/map\/exhibition\/\?floor=3F$/);
    await expect(page.getByRole("tab", { name: "3F", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(link).toBeVisible();
  });

  test("企画から戻ると選んでいた階を復元する", async ({ page }) => {
    await page.goto("/map/exhibition/");
    const exhibition = page.locator("main");
    await exhibition.getByRole("tab", { name: "3F" }).click();
    await exhibition.locator("a[href='/entry/rec-rigaku/']").click();
    await expect(page).toHaveURL(/\/entry\/rec-rigaku\/$/);
    await page.goBack();
    await expect(page).toHaveURL(/\?floor=3F$/);
    await expect(exhibition.getByRole("tab", { name: "3F" })).toHaveAttribute("aria-selected", "true");
    await expect(exhibition.locator("a[href='/entry/rec-rigaku/']")).toBeVisible();
  });

  test("学科展示タブに直接着地する", async ({ page }) => {
    await page.goto("/map/");
    await page.locator(".map-area-list [data-area='04']").click();
    await expect(page.getByRole("tab", { name: "学科展示" })).toHaveAttribute("aria-selected", "true");
  });

  test("階のタブからキーボードで配置図と企画へ順に進める", async ({ page }) => {
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/map/exhibition/?floor=2F");
      const tabs = page.locator("[data-floor-tabs]");
      const second = tabs.getByRole("tab", { name: "2F", exact: true });
      await second.focus();
      await page.keyboard.press("ArrowRight");
      await expect(tabs.getByRole("tab", { name: "3F", exact: true })).toBeFocused();
      await expect(page.getByRole("tabpanel", { name: "3F", exact: true })).toBeVisible();
      await page.keyboard.press("ArrowRight");
      await expect(tabs.getByRole("tab", { name: "1F", exact: true })).toBeFocused();
      await page.keyboard.press("End");
      await expect(tabs.getByRole("tab", { name: "3F", exact: true })).toBeFocused();
      await page.keyboard.press("Home");
      await expect(tabs.getByRole("tab", { name: "1F", exact: true })).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect(second).toBeFocused();
      await expect(page).toHaveURL(/\?floor=2F$/);
      await page.keyboard.press("Tab");
      const panel = page.getByRole("tabpanel", { name: "2F", exact: true });
      await expect(panel).toBeFocused();
      const focusStyle = await panel.evaluate((el) => ({ visible: el.matches(":focus-visible"), outline: getComputedStyle(el).outlineStyle }));
      expect(focusStyle.visible).toBe(true);
      expect(focusStyle.outline).toBe("solid");
      await page.keyboard.press("Tab");
      const firstEntry = panel.getByRole("link").first();
      await expect(firstEntry).toBeFocused();
      await page.keyboard.press("Enter");
      const roomList = page.locator("[data-room-list='C:2F:2I']");
      await expect(roomList).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(roomList.locator("a")).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/entry\/rec-procon\/$/);
      await page.goBack();
      await expect(page).toHaveURL(/\/map\/exhibition\/\?floor=2F#room-C-2F-H8-I8$/);
      await expect(second).toHaveAttribute("aria-selected", "true");
    }
  });

  test("トイレを男女のマークで示し、凡例で説明する", async ({ page }) => {
    for (const [floor, kind, room] of [["1F", "male", "男子トイレ"], ["2F", "female", "女子トイレ"], ["3F", "male", "男子トイレ"]]) {
      await page.goto(`/map/exhibition/?floor=${floor}`);
      const diagram = page.locator(`#floor-${floor} .indoor-map`);
      const toilet = diagram.locator(`[data-building-diagram='C科棟'] [data-room='${room}']`);
      await expect(toilet.locator(`[data-toilet='${kind}']`)).toHaveCount(1);
      // 文字のWCは出さず、マークだけにする。
      await expect(toilet.locator("text")).toHaveCount(0);
      await expect(diagram.locator(`[data-toilet-key='${kind}']`)).toHaveCount(1);
      await expect(diagram.locator("figcaption")).toContainText(`＝${room}`);
      const colors = await diagram.evaluate((root, kind) => [root.querySelector(`[data-toilet='${kind}']`)!, root.querySelector(`[data-toilet-key='${kind}']`)!].map((el) => getComputedStyle(el).fill), kind);
      expect(new Set(colors).size, `${floor} 図と凡例のマークを同じ色にする`).toBe(1);
      expect(colors[0], `${floor} 男子は青・女子は赤`).toBe(kind === "male" ? "rgb(26, 51, 214)" : "rgb(227, 27, 35)");
    }
    // I科棟は通路を挟んで階段の反対側に男女両方のトイレがある。細い区画からマークがはみ出さない。
    for (const floor of ["1F", "2F"]) {
      await page.goto(`/map/exhibition/?floor=${floor}`);
      const toilet = page.locator(`#floor-${floor} [data-building-diagram='I科棟'] [data-room='男子・女子トイレ']`);
      await expect(toilet.locator("[data-toilet]")).toHaveCount(2);
      const result = await toilet.evaluate((room) => {
        const box = room.querySelector("rect")!.getBoundingClientRect();
        return [...room.querySelectorAll<SVGGElement>("[data-toilet]")].map((mark) => {
          const b = mark.getBoundingClientRect();
          return { kind: mark.dataset.toilet, inside: b.left >= box.left && b.right <= box.right && b.top >= box.top && b.bottom <= box.bottom };
        });
      });
      expect(result.map(({ kind }) => kind), `${floor} I科棟のトイレ`).toEqual(["male", "female"]);
      expect(result.every(({ inside }) => inside), `${floor} マークが区画に収まる`).toBe(true);
      await expect(page.locator(`#floor-${floor} figcaption`)).toContainText("＝男子トイレ");
      await expect(page.locator(`#floor-${floor} figcaption`)).toContainText("＝女子トイレ");
    }
  });

  test("教室配置図の読み上げ用名称と詳しい説明を分けて伝える", async ({ page }) => {
    for (const floor of ["1F", "2F", "3F"]) {
      await page.goto(`/map/exhibition/?floor=${floor}`);
      const diagram = page.getByRole("tabpanel", { name: floor, exact: true }).getByRole("group", { name: `${floor}の教室配置図`, exact: true });
      await expect(diagram).toHaveAccessibleName(`${floor}の教室配置図`);
      await expect(diagram).toHaveAccessibleDescription(/C科棟.*黄色は掲載企画の教室/);
    }
  });

  test("狭い画面で文字を200%にしてもエリア一覧を横スクロールせず読める", async ({ page }) => {
    for (const width of [320, 375, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/map/");
      await page.evaluate(() => document.fonts.ready);
      await page.locator(".map-area-list").evaluate((list) => {
        const sizes = [...list.querySelectorAll<HTMLElement>("*")].map((el) => ({ el, size: parseFloat(getComputedStyle(el).fontSize) }));
        for (const { el, size } of sizes) el.style.fontSize = `${size * 2}px`;
      });
      const list = page.locator(".map-area-list");
      await expect(list.getByRole("link")).toHaveCount(4);
      const result = await list.evaluate((root) => {
        const frame = root.getBoundingClientRect();
        const links = [...root.querySelectorAll("a")];
        const outside = links.filter((el) => {
          const b = el.getBoundingClientRect();
          return b.left < frame.left - 1 || b.right > frame.right + 1;
        }).map((el) => el.textContent);
        const overflowingText = [...root.querySelectorAll(".area-number, .area-copy strong")].filter((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const box = el.getBoundingClientRect();
          return [...range.getClientRects()].some((b) => b.left < box.left - 1 || b.right > box.right + 1);
        }).map((el) => el.textContent);
        return { scroll: document.documentElement.scrollWidth - innerWidth, outside, overflowingText };
      });
      expect(result.scroll, `${width}px 横スクロール`).toBeLessThanOrEqual(1);
      expect(result.outside, `${width}px 一覧のはみ出し`).toEqual([]);
      expect(result.overflowingText, `${width}px 番号と名称を省略・重なりなしで読める`).toEqual([]);
    }
  });

  test("図の操作が重ならず、文字拡大と低減設定でも案内が残る", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/map/");
    const overlaps = await page.locator(".campus-map a").evaluateAll((links) => {
      const boxes = links.map((el) => ({ label: el.getAttribute("aria-label"), b: el.getBoundingClientRect() }));
      return boxes.flatMap((a, i) => boxes.slice(i + 1).filter(({ b }) => a.b.left < b.right && a.b.right > b.left && a.b.top < b.bottom && a.b.bottom > b.top).map((b) => [a.label, b.label]));
    });
    expect(overlaps).toEqual([]);
    await page.addStyleTag({ content: ".map-page { font-size: 200%; } .map-area-list strong { font-size: 200% !important; }" });
    const width = await page.evaluate(() => ({ full: document.documentElement.scrollWidth, view: innerWidth }));
    expect(width.full).toBeLessThanOrEqual(width.view + 1);
    await expect(page.locator(".map-area-list [data-area='03']")).toBeVisible();
  });

  test("案内ページから戻ると全体MAPの一覧の位置に戻る", async ({ page }) => {
    await page.goto("/map/");
    const card = page.locator(".map-area-list [data-area='02']");
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await expect(page).toHaveURL(/\/map\/exhibition\/$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/map\/$/);
    await expect(card).toBeInViewport();
  });

  test("JavaScriptなしでも一覧と企画情報を読める", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await page.goto("http://localhost:4325/map/");
    await expect(page.locator(".map-area-list > li")).toHaveCount(4);
    await expect(page.locator(".campus-map [data-area='01']")).toHaveAttribute("href", "/map/food/");
    await expect(page.locator(".campus-map [data-area='03']")).toHaveAttribute("href", "/map/game/");
    await page.goto("http://localhost:4325/map/multimedia/");
    await expect(page.locator("main a[href='/entry/rec-kado/']")).toBeVisible();
    // 階の切替はJSで動くので、JSなしではタブを出さずに全階を並べる
    await page.goto("http://localhost:4325/map/exhibition/");
    await expect(page.locator("main [role='tablist']")).toBeHidden();
    for (const id of ["rec-kagaku-magic", "rec-procon", "rec-rigaku"]) {
      await expect(page.locator(`main a[href='/entry/${id}/']`)).toBeVisible();
    }
    await context.close();
  });

  test("ステージ・棟・本部は、本部の絵の看板と同じく建物に名札を重ねて示す", async ({ page }) => {
    // ステージは番号を持たず、名札からタイムテーブルへ進む。棟と本部は案内ページへのリンク。
    const plates = [
      { name: "LiveStage", selector: "[data-stage-name='LiveStage'] .name-plate", art: "1005:224", link: true },
      { name: "MainStage", selector: "[data-stage-name='MainStage'] .name-plate", art: "1005:235", link: true },
      { name: "SubStage", selector: "[data-stage-name='SubStage'] .name-plate", art: "1005:269", link: true },
      { name: "マルチメディア棟", selector: "[data-venue='multimedia'] .name-plate", art: "1279:2196", link: true },
      { name: "本部", selector: "[data-venue='headquarters'] .name-plate", art: "1285:2266", link: true },
    ];
    for (const width of [320, 360, 375, 414, 600, 768, 899, 900, 1024, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/map/");
      await page.evaluate(() => document.fonts.ready);
      const result = await page.locator(".campus-map").evaluate((map, plates) => {
        const frame = map.getBoundingClientRect();
        const papers = [...map.querySelectorAll(".label-paper")].map((el) => el.getBoundingClientRect());
        const all = [...map.querySelectorAll(".name-plate")];
        const overlaps = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
        return plates.map(({ name, selector, art, link }) => {
          const plate = map.querySelector(selector)!;
          const box = plate.getBoundingClientRect();
          const piece = map.querySelector(`[data-node-id='${art}']`)!.getBoundingClientRect();
          const centerX = box.left + box.width / 2, centerY = box.top + box.height / 2;
          return { name, text: plate.textContent, linkMatches: Boolean(plate.closest("a")) === link,
            onArt: centerX > piece.left && centerX < piece.right && centerY > piece.top && centerY < piece.bottom,
            coversLabel: papers.some((paper) => overlaps(box, paper)),
            coversPlate: all.some((other) => other !== plate && overlaps(box, other.getBoundingClientRect())),
            // スマホ幅の棟の名札は建物の中心にそろえるため、図の右端からページ余白へはみ出してよい（別の検査で画面内を確認）。
            outside: (name === "マルチメディア棟" && frame.width <= 680 ? false : box.left < frame.left - 1 || box.right > frame.right + 1) || box.bottom > frame.bottom + 1,
            fontSize: parseFloat(getComputedStyle(plate).fontSize) };
        });
      }, plates);
      for (const { name, text, linkMatches, onArt, coversLabel, coversPlate, outside, fontSize } of result) {
        expect(text, `${width}px ${name}の名札`).toBe(name);
        expect(linkMatches, `${width}px ${name}のリンクの有無`).toBe(true);
        expect(onArt, `${width}px ${name}の名札が絵の上にある`).toBe(true);
        expect(coversLabel, `${width}px ${name}の名札が番号札に重ならない`).toBe(false);
        expect(coversPlate, `${width}px ${name}の名札同士が重ならない`).toBe(false);
        expect(outside, `${width}px ${name}の名札が図からはみ出さない`).toBe(false);
        // 最狭幅を除き11px以上で読める。スマホ幅の本部は絵の看板と同じ幅にするため10px（2026-10-12ユーザー決定）。
        expect(fontSize, `${width}px ${name}の名札の文字`).toBeGreaterThanOrEqual(width <= 320 || (name === "本部" && width < 900) ? 10 : 11);
      }
    }
  });

  test("ステージの名札からタイムテーブルの該当ステージへ進み、元の名札へ戻れる", async ({ page }) => {
    // ノッチの余白がある端末でもステージ名が固定帯の下へ隠れない。
    await page.addInitScript(() => {
      const observer = new MutationObserver(() => {
        if (!document.documentElement) return;
        document.documentElement.style.setProperty("--safe-top", "44px");
        observer.disconnect();
      });
      observer.observe(document, { childList: true });
    });
    for (const stage of ["LiveStage", "MainStage", "SubStage"]) {
      await page.goto("/map/");
      const source = page.locator(`.campus-map [data-stage-name='${stage}']`);
      await source.click();
      await expect(page).toHaveURL(new RegExp(`/timetable/.*#stage-${stage}$`));
      const back = page.getByRole("link", { name: "MAPに戻る", exact: false });
      await expect(back).toBeInViewport();
      await expect.poll(async () => page.evaluate((stage) => {
        const target = document.getElementById(`stage-${stage}`)!.getBoundingClientRect();
        const tabs = document.querySelector(".tab-tag-filter")!.getBoundingClientRect();
        return target.top >= tabs.bottom - 1;
      }, stage)).toBe(true);
      // 一瞬だけ合っていても、その後のスクロールで固定帯に隠れない。
      const gaps = await page.evaluate(async (stage) => {
        await document.fonts.ready;
        const gaps: number[] = [];
        for (let frame = 0; frame < 30; frame++) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          gaps.push(document.getElementById(`stage-${stage}`)!.getBoundingClientRect().top - document.querySelector(".tab-tag-filter")!.getBoundingClientRect().bottom);
        }
        return gaps;
      }, stage);
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(-1);
      await back.click();
      await expect(page).toHaveURL(/\/map\/$/);
      await expect(source).toBeInViewport();
    }
    await page.goto("/timetable/");
    await expect(page.getByRole("link", { name: "MAPに戻る", exact: false })).toHaveCount(0);
  });

  test("ステージの名札は当日の日程のタイムテーブルへ着地する", async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${site.day2Date}T09:10:00+09:00`));
    await page.goto("/map/");
    const stage = page.locator(".campus-map [data-stage-name='MainStage']");
    await expect(stage).toHaveAttribute("href", "/timetable/?tab=day2#stage-MainStage");
    await stage.click();
    await expect(page.getByRole("tab").filter({ hasText: "11/1" })).toHaveAttribute("aria-selected", "true");
    await page.clock.setFixedTime(new Date(`${site.day1Date}T09:10:00+09:00`));
    await page.goto("/map/");
    await expect(stage).toHaveAttribute("href", "/timetable/?tab=day1#stage-MainStage");
    // ステージは地図下のエリア一覧には載せない。
    await expect(page.locator(".map-area-list a[href^='/timetable/']")).toHaveCount(0);
  });

  test("狭い画面と中間幅でも地図の札が重ならない", async ({ page }) => {
    await page.goto("/map/");
    await page.evaluate(() => document.fonts.ready);
    for (const width of [320, 375, 600, 768, 899, 900, 1024, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      for (const selector of [".campus-map a"]) {
        const collisions = await page.locator(selector).evaluateAll((elements) => {
          const boxes = elements.map((el) => ({ text: el.textContent, box: el.getBoundingClientRect() }));
          return boxes.flatMap((a, i) => boxes.slice(i + 1).filter(({ box: b }) => a.box.left < b.right && a.box.right > b.left && a.box.top < b.bottom && a.box.bottom > b.top).map((b) => [a.text, b.text]));
        });
        expect(collisions, `${width}px ${selector}`).toEqual([]);
      }
      const viewport = await page.evaluate(() => ({ full: document.documentElement.scrollWidth, view: innerWidth }));
      expect(viewport.full, `${width}px横スクロール`).toBeLessThanOrEqual(viewport.view + 1);
    }
  });
});
