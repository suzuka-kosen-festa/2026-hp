import { expect, test } from "@playwright/test";
import { describePage } from "./_shared";

describePage("access", "/access/");

/**
 * 駐車場の図が画面の高さを占領しないこと（MTG 2026-09-06 の指摘）。
 *
 * 以前は幅いっぱい（= 画面高の78%）まで伸びており、注意点やGoogleマップの
 * ボタンを見るのにスクロールが要った。画像の実解像度は 485x529 しかないので、
 * 引き伸ばして粗くなってもいた。
 *
 * 横長＝高さの足りない画面で崩れる問題なので、低めのビューポートで検査する。
 */
test("駐車場の図が画面の高さを占領しない", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/access/");

  const img = page.locator(".parking-panel img").first();
  const box = await img.boundingBox();
  expect(box, "駐車場の図が見つかりません").toBeTruthy();

  const ratio = box!.height / 800;
  expect(ratio, `図が画面高の${Math.round(ratio * 100)}%を占めています`).toBeLessThan(0.7);

  // 実解像度を超えて引き伸ばしていないか（多少の丸めは許容する）
  const natural = await img.evaluate((i: HTMLImageElement) => i.naturalWidth);
  expect(box!.width).toBeLessThanOrEqual(natural * 1.1);
});

/**
 * PCでは図と説明が左右に並ぶこと。
 *
 * 指摘の本体は「図が大きい」ことではなく「他の情報を見るのにスクロールが要る」
 * ことなので、縦積みに戻っていないかを見る。縦積みだとパネルの高さが
 * 「図＋文章」になり、1画面に収まらなくなる（変更前は974px＝画面の122%）。
 *
 * SPは従来どおり縦積みなので、PC幅でだけ検査する。
 */
test("PCでは駐車場の図と説明が左右に並ぶ", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/access/");

  const panel = page.locator("[data-parking-panel]:not([hidden])").first();
  const img = panel.locator("img").first();
  const body = panel.locator(".panel-body").first();

  const imgBox = (await img.boundingBox())!;
  const bodyBox = (await body.boundingBox())!;
  expect(imgBox, "駐車場の図が見つかりません").toBeTruthy();
  expect(bodyBox, "説明の箱が見つかりません").toBeTruthy();

  // 図の右端より説明の左端が右にある＝横に並んでいる
  expect(
    bodyBox.x,
    `図と説明が横に並んでいません（図の右端 ${Math.round(imgBox.x + imgBox.width)}px、説明の左端 ${Math.round(bodyBox.x)}px）`,
  ).toBeGreaterThanOrEqual(imgBox.x + imgBox.width);

  const panelBox = (await panel.boundingBox())!;
  expect(
    panelBox.height,
    `パネルが画面高の${Math.round((panelBox.height / 800) * 100)}%を占めています`,
  ).toBeLessThan(800);
});

/**
 * 駐車場の切り替えが生きていること。
 *
 * PCの左右振り分けを入れたとき、素の .parking-panel に display:grid を書いて
 * [hidden] の display:none（UAスタイル）を上書きしてしまい、3枚が同時に
 * 表示された。:not([hidden]) で要素を選ぶ検査では属性上は正しい1枚が取れて
 * しまい気づけなかったので、「見えている数」を数える。
 */
test("駐車場パネルは常に1枚だけ表示される", async ({ page }) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/access/");

    const panels = page.locator("[data-parking-panel]");
    const total = await panels.count();
    expect(total, "駐車場パネルが見つかりません").toBeGreaterThan(1);

    const tabs = page.locator("[role=tab]");

    for (let i = 0; i < total; i++) {
      await tabs.nth(i).click();

      const visible = await panels.evaluateAll(
        (els) => els.filter((el) => (el as HTMLElement).offsetParent !== null).length,
      );
      expect(visible, `${width}px でタブ${i + 1}を選んだとき ${visible} 枚見えています`).toBe(1);
    }
  }
});
