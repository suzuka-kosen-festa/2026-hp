import { expect, test } from "@playwright/test";
import site from "../src/data/site.json" with { type: "json" };
import { describePage } from "./_shared";

describePage("holding", "/holding/");

/**
 * holding は本番で全URLが返すページなので、壊れると全滅する。
 *
 * Prettier導入時（#52）に prettier-plugin-astro がこのファイルを壊し、
 * <title> から「collage」が落ち、</head> が title の途中で閉じ、OGPのmetaが
 * head の外に出た。それでもポスター画像は表示されるため、既存の describePage
 * だけでは素通りしていた。head の中身は目で見えないので明示的に検査する。
 */
test("タイトルとOGPが head に収まっている", async ({ page }) => {
  await page.goto("/holding/");

  await expect(page).toHaveTitle(`${site.eventName}「${site.theme}」`);

  // head の外に出ていると count が 0 になる
  await expect(page.locator('head meta[property="og:title"]')).toHaveCount(1);
  await expect(page.locator('head meta[name="description"]')).toHaveCount(1);
  await expect(page.locator('head meta[property="og:image"]')).toHaveCount(1);
});
