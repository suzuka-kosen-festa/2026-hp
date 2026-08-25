import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/**
 * 公開制御（src/data/release.json）の検査。
 *
 * 検査の期待値は、そのビルドが「公開制御を適用しているか」で変わる。
 * プレビューで配信されるものとテストが見るものを揃えるため、ビルドと同じ
 * APPLY_RELEASE を見る。
 *
 *   未設定 … 通常のPR。全ページ公開（実装中のページが見える）
 *   1      … 公開設定を変えるPR / 本番。published どおり
 */
const releasePath = fileURLToPath(new URL("../src/data/release.json", import.meta.url));
const release: { mode: string; published: string[] } = JSON.parse(readFileSync(releasePath, "utf8"));

const APPLY_RELEASE = process.env.APPLY_RELEASE === "1";
const isHolding = release.mode === "holding";

/** 判定の対象外（lib/release.ts の EXEMPT と揃える） */
const EXEMPT = ["/gallery/", "/holding/", "/404"];

/** ヘッダーのnavが全ページからリンクしている先。未公開でも404にしてはいけない */
const NAV_PATHS = ["/", "/timetable/", "/map/", "/booth/", "/access/", "/sponsors/", "/news/"];

const shouldBePublished = (path: string) =>
  !APPLY_RELEASE || release.published.includes(path) || EXEMPT.some((e) => path.startsWith(e));

test.describe(`公開制御（APPLY_RELEASE=${APPLY_RELEASE ? "1" : "未設定"}）`, () => {
  for (const path of NAV_PATHS) {
    test(`${path} はnavからリンクされているので必ず表示できる`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status(), `${path} が404になっています`).toBe(200);

      // ページ自身が出す準備中（map/sponsors のような未実装ページ）と区別するため、
      // 公開制御による準備中だけを見る
      const hasPlaceholder = (await page.locator("[data-release-gate]").count()) > 0;

      if (shouldBePublished(path)) {
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

  test("sitemap は本番に実在するURLだけを載せる", async ({ request }) => {
    const xml = await (await request.get("/sitemap-0.xml")).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);

    if (APPLY_RELEASE && isHolding) {
      // ホールディング中は本番に実在するのがポスター1枚だけ。
      // 実体の無いURLを申告し続けると、消えたあとも検索結果から飛ばれ続ける
      expect(locs, "ホールディング中の sitemap は / だけであるべきです").toEqual(["/"]);
      return;
    }

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
