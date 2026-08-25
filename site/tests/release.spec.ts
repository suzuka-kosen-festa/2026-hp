import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/**
 * 公開制御（src/data/release.json）が効いているかを検査する。
 *
 * 「published に足したのに準備中のまま」「外したのに公開されている」は
 * 目視では気づきにくく、気づいたときには公開事故になっている。
 * release.json を書き換えたらこのテストが自動で追従する。
 */
const releasePath = fileURLToPath(new URL("../src/data/release.json", import.meta.url));
const release: { mode: string; published: string[] } = JSON.parse(readFileSync(releasePath, "utf8"));

/** 判定の対象外（lib/release.ts の EXEMPT と揃える） */
const EXEMPT = ["/gallery/", "/holding/", "/404"];

/** ヘッダーのnavが全ページからリンクしている先。未公開でも404にしてはいけない */
const NAV_PATHS = ["/", "/timetable/", "/map/", "/booth/", "/access/", "/sponsors/", "/news/"];

test.describe("公開制御", () => {
  for (const path of NAV_PATHS) {
    test(`${path} はnavからリンクされているので必ず表示できる`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status(), `${path} が404になっています`).toBe(200);

      const isPublished =
        release.published.includes(path) || EXEMPT.some((exempt) => path.startsWith(exempt));
      const hasPlaceholder = (await page.locator("text=COMING SOON").count()) > 0;

      if (isPublished) {
        expect(hasPlaceholder, `${path} は公開対象なのに準備中が出ています`).toBe(false);
      } else {
        expect(hasPlaceholder, `${path} は未公開なのに中身が出ています`).toBe(true);
        await expect(
          page.locator('meta[name="robots"][content*="noindex"]'),
          `${path} は準備中なので noindex が要ります`,
        ).toHaveCount(1);
      }
    });
  }

  test("sitemap には公開中のページだけが載る", async ({ request }) => {
    const xml = await (await request.get("/sitemap-0.xml")).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);

    for (const path of locs) {
      const section = `/${path.split("/").filter(Boolean)[0] ?? ""}/`;
      const ok = release.published.includes(path) || release.published.includes(section);
      expect(ok, `${path} は未公開なのに sitemap に載っています`).toBe(true);
    }
    for (const path of ["/gallery/", "/holding/"]) {
      expect(locs, `${path} は sitemap に載せない`).not.toContain(path);
    }
  });
});
