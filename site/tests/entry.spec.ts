import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { describePage } from "./_shared";

// 開催回・対象・定員・注記を全部持つ、いま一番情報量の多いエントリ
describePage("entry", "/entry/workshop-ai-sorting-robot/");

/**
 * 写真を用意できない企画は今後も存在するので、画像なしを正式なレイアウトとして扱う。
 * 16:9の「NO IMAGE」枠を出すと、その高さぶんがまるごと無駄になる（Issue #56）。
 * 実データが入って画像の有無が変わっても追従するよう、データから引いて検査する。
 */
const entriesDir = new URL("../src/data/entries/", import.meta.url);
const entries: { id: string; image?: string }[] = ["booth", "department", "program"].flatMap((name) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`${name}.json`, entriesDir)), "utf8")),
);

const withoutImage = entries.find((entry) => !entry.image);
const withImage = entries.find((entry) => entry.image);

test.describe("entry の画像", () => {
  test.skip(!withoutImage, "画像なしのエントリが無いため");

  test("画像が無い企画は写真枠ごと出さない", async ({ page }) => {
    await page.goto(`/entry/${withoutImage!.id}/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".photo"), "画像が無いのに写真枠が残っています").toHaveCount(0);
    await expect(page.getByText("NO IMAGE"), "NO IMAGE のプレースホルダが出ています").toHaveCount(0);
    // 中身が消えていないことも見る（枠を消しすぎていないか）
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("entry の画像（あり）", () => {
  test.skip(!withImage, "画像ありのエントリがまだ無いため");

  test("画像がある企画は今までどおり写真枠を出す", async ({ page }) => {
    await page.goto(`/entry/${withImage!.id}/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".photo img")).toHaveCount(1);
  });
});
