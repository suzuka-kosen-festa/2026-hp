import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { describePage } from "./_shared";

describePage("thanks", "/thanks/");

const read = (file: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../src/data/${file}`, import.meta.url)), "utf8"));
const release: { mode: string } = read("release.json");
const sponsors: { name: string }[] = read("sponsors.json");

test.describe("thanks（お礼ページ）", () => {
  test("協賛の名前が全員ぶん載っている", async ({ page }) => {
    await page.goto("/thanks/");
    // 名前は折り返し用に分割して描画されるので、空白を詰めて比べる
    const text = (await page.locator("main").innerText()).replace(/\s/g, "");
    for (const s of sponsors) {
      expect(text, `${s.name} が載っていません`).toContain(s.name.replace(/\s/g, ""));
    }
  });

  test("サイト内リンクを持たない", async ({ page }) => {
    // 本番では全URLがこのページになるので、サイト内リンクは押しても同じページに戻るだけになる
    await page.goto("/thanks/");
    const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    expect(hrefs.filter((h) => !/^(mailto:|https?:)/.test(h))).toEqual([]);
  });

  test("閉幕モードの本番ビルドでは sitemap が / だけになる", async ({ request }) => {
    test.skip(process.env.APPLY_RELEASE !== "1" || release.mode !== "closed", "mode が closed の本番ビルドでのみ検査できる");
    const xml = await (await request.get("/sitemap-0.xml")).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    expect(locs).toEqual(["/"]);
  });
});
