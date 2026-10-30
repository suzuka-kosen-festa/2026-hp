import { expect, test } from "@playwright/test";
import { describePage } from "./_shared";

describePage("gallery", "/gallery/");

// 本番の成果物からは除外されるページなので、本番モードのビルドでは検査できない
// （scripts/strip-dev-pages.mjs）
test.skip(process.env.APPLY_RELEASE === "1", "/gallery/ は本番の成果物から除外されるため");

test("終了後の日付でも当日OPを試聴でき、低減設定では完成ロゴが見える", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-05T00:00:00+09:00"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/gallery/");
  await expect(page.locator("astro-island[component-url*='OpSplash']")).not.toHaveAttribute("ssr", "");
  await expect(page.locator(".op-splash")).toHaveCount(0);
  await page.getByRole("button", { name: "当日OPを再生" }).click();
  await expect(page.locator(".festival-photo-artwork")).toHaveCSS("opacity", "1");
  await expect(page.locator(".festival-photo-camera")).toHaveCSS("transform", "none");
  await page.getByRole("button", { name: "SKIP" }).click();
  await expect(page.locator(".op-splash")).toHaveCount(0);
});
