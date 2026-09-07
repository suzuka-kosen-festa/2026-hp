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
