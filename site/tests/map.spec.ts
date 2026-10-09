import { describePage } from "./_shared";

describePage("map", "/map/");
for (const sub of ["food", "exhibition", "multimedia", "headquarters", "innovation-plaza"]) describePage(`map/${sub}`, `/map/${sub}/`);

import { test, expect } from "@playwright/test";
import { showsContent } from "./_shared";
import { readFileSync } from "node:fs";
const site = JSON.parse(readFileSync(new URL("../src/data/site.json", import.meta.url), "utf8"));

test.describe("MAP案内", () => {
  test.skip(!showsContent("/map/"), "公開設定による準備中。通常プレビューでは実行する");
  test("会場札の名称と一覧の操作説明を細かくしすぎず読める", async ({ page }) => {
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/map/");
      const names = await page.locator(".campus-map .area-name").evaluateAll((nodes) => nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)));
      expect(names).toHaveLength(7);
      expect(names.every((size) => size >= (width === 375 ? 12 : 14))).toBe(true);
      const descriptions = await page.locator(".map-area-list .area-copy > small").evaluateAll((nodes) => nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)));
      expect(descriptions).toHaveLength(7);
      expect(descriptions.every((size) => size >= 14)).toBe(true);
    }
  });
  test("エリア一覧は内部の案内へ進む矢印で統一する", async ({ page }) => {
    await page.goto("/map/");
    await expect(page.locator(".map-area-list .action-arrow")).toHaveText(Array(7).fill("→"));
    await page.locator(".map-area-list [data-area='03']").click();
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
    for (const name of ["ダイソウ", "飲食スペース", "自衛隊展示", "バザーの一時避難場所", "本部控室2"]) await expect(first).toContainText(name);
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
    await expect(map.getByRole("img")).toBeVisible();
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
    await expect(researchRoom.locator(".shared-room")).toBeVisible();
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
    await page.getByRole("link", { name: "← 会場マップに戻る" }).click();
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
  test("人間が配置した7つのエリア札を図と一覧で同じ案内につなぐ", async ({ page }) => {
    await page.goto("/map/");
    await expect(page.getByRole("heading", { name: "会場マップ", exact: true })).toBeVisible();
    await expect(page.locator(".campus-art img")).toHaveCount(30);
    await expect.poll(() => page.locator(".campus-art img").evaluateAll((els) => els.every((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await expect(page.locator(".map-area-list > li")).toHaveCount(7);
    await expect(page.locator(".campus-map .area-label")).toHaveCount(7);
    for (const code of ["01", "02", "03", "04", "05", "06", "07"]) {
      const diagram = page.locator(`.campus-map [data-area='${code}']`);
      const list = page.locator(`.map-area-list [data-area='${code}']`);
      expect(await diagram.getAttribute("href")).toBe(await list.getAttribute("href"));
      const box = await diagram.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
  test("03と05の地図札から案内へ進み、戻って同じ札を使える", async ({ page }) => {
    await page.goto("/map/");
    await page.locator(".campus-map [data-area='03']").click();
    await expect(page).toHaveURL(/\/map\/food\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("飲食バザー");
    await expect(page.locator(".bazaar-map")).toBeVisible();
    await page.goBack();
    await expect(page.locator(".campus-map [data-area='03']")).toBeVisible();
    await page.locator(".campus-map [data-area='05']").click();
    await expect(page).toHaveURL(/\/entry\/game-tournament\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goBack();
    await expect(page.locator(".campus-map [data-area='05']")).toBeVisible();
  });
  test("スマホの地図だけで7エリアの名称を読めて、札同士を押し間違えない", async ({ page }) => {
    const expected = [
      ["01", "LiveStage"], ["02", "MainStage"], ["03", "飲食バザー"],
      ["04", "展示・レク"], ["05", "ゲームイベント"], ["06", "SubStage"], ["07", "学科展示 ←"],
    ];
    for (const width of [375, 320, 600, 768, 899, 900, 1024, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/map/");
      await page.evaluate(() => document.fonts.ready);
      for (const [code, name] of expected) {
        const label = page.locator(`.campus-map [data-area='${code}'] .area-name`);
        await expect(label).toBeVisible();
        await expect(label).toHaveText(name);
      }
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
          outside: boxes.filter(({ b }) => b.left < frame.left - 1 || b.right > frame.right + 1 || b.top < frame.top - 1 || b.bottom > frame.bottom + 1).map(({ name }) => name),
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
  test("MainStageの絵を番号札で隠さず、札から時間を確認できる", async ({ page }) => {
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
    await page.locator(".campus-map [data-area='02']").click();
    await expect(page).toHaveURL(/\/timetable\/.*#stage-MainStage$/);
    await expect(page.locator("#stage-MainStage")).toBeInViewport();
  });
  test("MainStageの番号と名称を一枚の紙札に収め、屋台を隠さずステージの時間へ進める", async ({ page }) => {
    for (const width of [375, 320, 410, 411, 450, 480, 514, 515, 600, 768, 899, 900, 1024, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/map/");
      await page.evaluate(() => document.fonts.ready);
      const result = await page.locator(".campus-map").evaluate((map) => {
        const anchor = map.querySelector("[data-area='02']")!;
        const paper = anchor.querySelector(".label-paper")!.getBoundingClientRect();
        const name = anchor.querySelector(".area-name")!.getBoundingClientRect();
        const code = anchor.querySelector("b")!.getBoundingClientRect();
        const stage = map.querySelector("[data-node-id='1005:235']")!.getBoundingClientRect();
        const stalls = [...map.querySelectorAll(".art-piece")].filter((el) => el.querySelector("img")!.src.includes("stall-red"));
        const coveredStalls = stalls.filter((el) => {
          const stall = el.getBoundingClientRect();
          return [paper, name].some((b, index) => Math.min(b.right + (index === 0 ? 2 : 0), stall.right) - Math.max(b.left, stall.left) > 0.5
            && Math.min(b.bottom + (index === 0 ? 2 : 0), stall.bottom) - Math.max(b.top, stall.top) > 0.5);
        }).map((el) => el.getAttribute("data-node-id"));
        const outsidePaper = [code, name].filter((b) => b.left < paper.left || b.right > paper.right || b.top < paper.top || b.bottom > paper.bottom);
        const stageGap = Math.hypot(Math.max(0, stage.left - paper.right, paper.left - stage.right), Math.max(0, stage.top - paper.bottom, paper.top - stage.bottom));
        const style = getComputedStyle(anchor, "::after");
        const box = anchor.getBoundingClientRect();
        const pointer = map.getBoundingClientRect().width <= 680 ? {
          x: box.left + parseFloat(style.left) + parseFloat(style.width) - 1,
          gap: stage.bottom - (box.top + parseFloat(style.top)),
        } : null;
        return { coveredStalls, outsidePaper: outsidePaper.length, stageGap, belowStage: paper.top - stage.bottom, pointer, stageLeft: stage.left, stageRight: stage.right };
      });
      expect(result.outsidePaper, `${width}px 番号と名称が同じ紙札の中にある`).toBe(0);
      expect(result.coveredStalls, `${width}px MainStageの札や名称が屋台を隠さない`).toEqual([]);
      expect(result.stageGap, `${width}px 紙札がステージの近くにある`).toBeLessThanOrEqual(40);
      expect(result.belowStage, `${width}px MainStageの札がステージの下にある`).toBeGreaterThanOrEqual(0);
      if (result.pointer) {
        expect(result.pointer.x).toBeGreaterThanOrEqual(result.stageLeft);
        expect(result.pointer.x).toBeLessThanOrEqual(result.stageRight);
        expect(result.pointer.gap, `${width}px 案内線がステージの下端だけを指す`).toBeGreaterThanOrEqual(3);
        expect(result.pointer.gap).toBeLessThanOrEqual(5);
      }
      await page.locator(".campus-map [data-area='02'] .area-name").click();
      await expect(page).toHaveURL(/\/timetable\/.*#stage-MainStage$/);
      await expect(page.locator("#stage-MainStage")).toBeInViewport();
    }
  });

  test("マルチメディア棟の屋根と正面を札と影で隠さず、棟名から案内へ進める", async ({ page }) => {
    for (const width of [375, 320, 600, 768, 899, 900, 1024, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/map/");
      await page.evaluate(() => document.fonts.ready);
      const covering = await page.locator(".campus-map").evaluate((map) => {
        const art = map.querySelector("[data-node-id='1279:2196']")!.getBoundingClientRect();
        return [...map.querySelectorAll(".label-paper")].filter((el) => {
          const b = el.getBoundingClientRect();
          // Figmaの新しい棟名札は建物の足元に配置。屋根と正面の上80%は隠さない。
          const protectedBottom = el.closest("[data-venue='multimedia']") ? art.bottom - art.height * 0.2 : art.bottom;
          return Math.min(b.right + 2, art.right) - Math.max(b.left, art.left) > 0.5
            && Math.min(b.bottom + 2, protectedBottom) - Math.max(b.top, art.top) > 0.5;
        }).map((el) => el.textContent);
      });
      expect(covering, `${width}px マルチメディア棟を覆う札`).toEqual([]);
    }
    await page.locator(".campus-map [data-venue='multimedia']").click();
    await expect(page).toHaveURL(/\/map\/multimedia\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("マルチメディア棟");
  });

  test("マルチメディア棟の小さな札を建物の足元に置き、正式名称を切らない", async ({ page }) => {
    for (const width of [375, 320, 600, 768, 899, 900, 1024, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/map/");
      await page.evaluate(() => document.fonts.ready);
      const label = page.locator(".campus-map [data-venue='multimedia']");
      await expect(label).toHaveText("マルチメディア棟");
      const result = await label.evaluate((anchor) => {
        const map = anchor.closest(".campus-map")!;
        const art = map.querySelector("[data-node-id='1279:2196']")!.getBoundingClientRect();
        const paper = anchor.querySelector(".label-paper")!.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(anchor.querySelector(".venue-long")!);
        return { belowRoof: paper.top >= art.top + art.height * 0.8, gap: paper.top - art.bottom,
          width: paper.width, height: paper.height,
          clipped: [...range.getClientRects()].some((b) => b.left < paper.left || b.right > paper.right || b.top < paper.top || b.bottom > paper.bottom) };
      });
      expect(result.belowRoof, `${width}px 棟の足元に札を置く`).toBe(true);
      expect(result.gap, `${width}px 棟から離れない`).toBeLessThanOrEqual(8);
      expect(result.width, `${width}px 小さな横長の札`).toBeLessThanOrEqual(100);
      expect(result.height, `${width}px 札の高さ`).toBeLessThanOrEqual(20);
      expect(result.clipped, `${width}px 正式名称の欠け`).toBe(false);
    }
  });

  test("LiveStageの01札を体育館の入口近くに置き、対応する時間へ進める", async ({ page }) => {
    for (const width of [375, 320, 600, 768, 899, 900, 1024, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/map/");
      await page.evaluate(() => document.fonts.ready);
      const placement = await page.locator(".campus-map").evaluate((map) => {
        const gym = map.querySelector("[data-node-id='1005:224']")!.getBoundingClientRect();
        const label = map.querySelector("[data-area='01'] .label-paper")!.getBoundingClientRect();
        return { gap: label.top - gym.bottom, center: label.left + label.width / 2, left: gym.left, right: gym.right };
      });
      expect(placement.gap, `${width}px 01札が体育館から離れすぎない`).toBeLessThanOrEqual(4);
      expect(placement.gap, `${width}px 01札が体育館の下にある`).toBeGreaterThanOrEqual(-0.5);
      expect(placement.center).toBeGreaterThanOrEqual(placement.left);
      expect(placement.center).toBeLessThanOrEqual(placement.right);
    }
    await page.locator(".campus-map [data-area='01']").click();
    await expect(page).toHaveURL(/\/timetable\/.*#stage-LiveStage$/);
    await expect(page.locator("#stage-LiveStage")).toBeInViewport();
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
    await page.locator(".map-area-list [data-area='03']").click();
    await expect(page).toHaveURL(/\/map\/food\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("飲食バザー");
    await expect(page.locator("main")).not.toContainText("詳細配置は準備中");
    await expect(page.locator(".bazaar-map")).toBeVisible();
    await expect(page.locator("[data-stall-group='food'] a")).toHaveCount(12);
    await expect(page.locator("[data-stall-group='sweets'] a")).toHaveCount(9);
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
    await expect(page.locator("[data-stall-group='sweets'] a .stall-badge[data-group='sweets']")).toHaveCount(9);
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
      ["フード", "8", "food-karate"], ["フード", "9", "food-koshiki-tennis"],
      ["フード", "10", "food-ongaku"], ["フード", "11", "food-yosakoi"],
      ["スイーツ", "0", "food-badminton"], ["スイーツ", "1", "food-handball"],
      ["スイーツ", "2", "food-kyudo"], ["スイーツ", "3", "food-shashin"],
      ["スイーツ", "4", "food-rikujo"], ["スイーツ", "5", "food-soccer"],
      ["スイーツ", "6", "food-procon"], ["スイーツ", "7", "food-kendo"],
      ["スイーツ", "8", "food-volleyball"],
    ];
    await expect(map.getByRole("link")).toHaveCount(21);
    for (const [group, code, id] of expected) {
      await expect(map.getByRole("link", { name: new RegExp(`^${group}${code} `) })).toHaveAttribute("href", `/entry/${id}/`);
    }
    await map.getByRole("link", { name: /^フード0 / }).click();
    await expect(page).toHaveURL(/\/entry\/food-5e\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ベーコンチーズ巻");
    await page.goBack();
    await map.getByRole("link", { name: /^スイーツ0 / }).click();
    await expect(page).toHaveURL(/\/entry\/food-badminton\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ワッフル");
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
    // 全体MAPは地図と一覧だけ。企画の一覧は各案内ページに置く（05はゲーム大会の詳細へ直接案内する）
    await expect(page.locator("main a[href^='/entry/']:not([data-area='05'])")).toHaveCount(0);
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
    await expect(page.locator(".map-area-list [data-area='03']")).toContainText("店舗と番号を見る");
    await expect(page.locator(".map-area-list [data-area='04']")).toContainText("棟・階の案内を見る");

    await page.locator(".map-area-list [data-area='04']").click();
    await expect(page).toHaveURL(/\/map\/exhibition\/$/);
    await expect(page.locator("main")).toContainText("教室配置図");
    await page.getByRole("tab", { name: "3F" }).click();
    await expect(page.locator("main a[href='/entry/rec-kagaku-magic/']")).toContainText("C科棟 3F・第三合併講義室");
    await page.getByRole("link", { name: "← 会場マップに戻る" }).click();
    await expect(page).toHaveURL(/\/map\/$/);

    await page.locator(".campus-map [data-venue='multimedia']").click();
    await expect(page.locator("main")).toContainText("入ってすぐ左側");
    await expect(page.locator("main a[href='/entry/food-sado/']")).toBeVisible();
    await expect(page.locator("main a[href='/entry/rec-kado/']")).toBeVisible();
    await page.getByRole("link", { name: "← 戻る" }).click();
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
    // ゲーム大会は05から直接案内するので、展示・レクの一覧には載せない
    await expect(exhibition.locator("a[href='/entry/game-tournament/']")).toHaveCount(0);

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
    await expect(page.locator("main a[href='/entry/game-tournament/']")).toHaveCount(0);
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

  test("ステージの列と学科展示タブに直接着地する", async ({ page }) => {
    for (const [code, stage] of [["01", "LiveStage"], ["02", "MainStage"], ["06", "SubStage"]]) {
      await page.goto("/map/");
      await page.locator(`.map-area-list [data-area='${code}']`).click();
      await expect(page).toHaveURL(new RegExp(`#stage-${stage}$`));
      await expect(page.locator(`#stage-${stage}`)).toBeInViewport();
    }
    await page.goto("/map/");
    await page.locator(".map-area-list [data-area='07']").click();
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
      await expect(page).toHaveURL(/\/entry\/rec-procon\/$/);
      await page.goBack();
      await expect(page).toHaveURL(/\/map\/exhibition\/\?floor=2F$/);
      await expect(second).toHaveAttribute("aria-selected", "true");
    }
  });

  test("教室配置図の読み上げ用名称と詳しい説明を分けて伝える", async ({ page }) => {
    for (const floor of ["1F", "2F", "3F"]) {
      await page.goto(`/map/exhibition/?floor=${floor}`);
      const diagram = page.getByRole("tabpanel", { name: floor, exact: true }).getByRole("img");
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
      await expect(list.getByRole("link")).toHaveCount(7);
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
    await expect(page.locator(".map-area-list [data-area='05']")).toBeVisible();
  });

  test("案内ページから戻ると全体MAPの一覧の位置に戻る", async ({ page }) => {
    await page.goto("/map/");
    const card = page.locator(".map-area-list [data-area='04']");
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
    await expect(page.locator(".map-area-list > li")).toHaveCount(7);
    await expect(page.locator(".campus-map [data-area='03']")).toHaveAttribute("href", "/map/food/");
    await expect(page.locator(".campus-map [data-area='05']")).toHaveAttribute("href", "/entry/game-tournament/");
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

  test("開催中表示とステージ導線は当日の日程を使い、中夜祭を混ぜない", async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${site.day2Date}T09:10:00+09:00`));
    await page.goto("/map/");
    await expect(page.locator("[data-now-stage='MainStage']")).toContainText("開催中 · 音楽部コンサート");
    await expect(page.locator(".map-area-list [data-area='02']")).toHaveAttribute("href", "/timetable/?tab=day2#stage-MainStage");
    await page.locator(".map-area-list [data-area='02']").click();
    await expect(page.getByRole("tab").filter({hasText:"11/1"})).toHaveAttribute("aria-selected", "true");
    await page.clock.setFixedTime(new Date(`${site.day1Date}T18:00:00+09:00`));
    await page.goto("/map/");
    await expect(page.locator(".map-now:visible")).toHaveCount(0);
    await page.clock.setFixedTime(new Date(`${site.day1Date}T09:10:00+09:00`));
    await page.goto("/map/");
    await expect(page.locator("[data-now-stage='MainStage']")).toContainText("開催中 · オープニング");
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
