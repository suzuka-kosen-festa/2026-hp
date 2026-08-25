import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/**
 * 未確定データの隠し忘れを検出する（Issue #48）。
 *
 * E2E は INCLUDE_DRAFTS を渡さずにビルドするので、ここで見えているものは
 * 本番でも見えている。draft を付けたのに出ている、が最も怖い失敗なのでそこを見る。
 */
const dataDir = new URL("../src/data/", import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(fileURLToPath(new URL(path, dataDir)), "utf8"));

const entries: { id: string; name: string; draft?: boolean }[] = [
  ...read("entries/booth.json"),
  ...read("entries/department.json"),
  ...read("entries/program.json"),
];
const news: { id: string; title: string; draft?: boolean }[] = read("news.json");
const sponsors: { name: string; draft?: boolean }[] = read("sponsors.json");

const draftEntries = entries.filter((e) => e.draft);
const draftNews = news.filter((n) => n.draft);
const draftSponsors = sponsors.filter((s) => s.draft);

test.describe("draft データが本番ビルドに出ていない", () => {
  test("draft の企画はページも一覧も出ない", async ({ page, request }) => {
    test.skip(draftEntries.length === 0, "draft の企画が無いため");
    for (const entry of draftEntries) {
      expect((await request.get(`/entry/${entry.id}/`)).status(), `${entry.id} のページが生成されています`).toBe(404);
    }
    await page.goto("/booth/", { waitUntil: "networkidle" });
    for (const entry of draftEntries) {
      await expect(page.locator(`a[href="/entry/${entry.id}/"]`), `${entry.id} が一覧に出ています`).toHaveCount(0);
    }
  });

  test("draft のお知らせは一覧にも詳細にも出ない", async ({ page, request }) => {
    test.skip(draftNews.length === 0, "draft のお知らせが無いため");
    for (const item of draftNews) {
      expect((await request.get(`/news/${item.id}/`)).status(), `${item.id} のページが生成されています`).toBe(404);
    }
    await page.goto("/news/", { waitUntil: "domcontentloaded" });
    for (const item of draftNews) {
      await expect(page.getByText(item.title, { exact: true }), `${item.title} が一覧に出ています`).toHaveCount(0);
    }
  });

  test("draft の協賛はフッターにも協賛ページにも出ない", async ({ page }) => {
    test.skip(draftSponsors.length === 0, "draft の協賛が無いため");
    await page.goto("/sponsors/", { waitUntil: "domcontentloaded" });
    for (const sponsor of draftSponsors) {
      await expect(page.getByText(sponsor.name, { exact: true }), `${sponsor.name} が出ています`).toHaveCount(0);
    }
  });

  test("sitemap に draft のURLが載らない", async ({ request }) => {
    const xml = await (await request.get("/sitemap-0.xml")).text();
    for (const entry of draftEntries) expect(xml).not.toContain(`/entry/${entry.id}/`);
    for (const item of draftNews) expect(xml).not.toContain(`/news/${item.id}/`);
  });
});
