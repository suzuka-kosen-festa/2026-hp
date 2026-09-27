import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const release = JSON.parse(
  readFileSync(fileURLToPath(new URL("../src/data/release.json", import.meta.url)), "utf8"),
) as { mode: string; published: string[] };

/**
 * このパスが「実際に中身を表示する」状態か。
 *
 * ページ固有の検査（カードのチップを見る、等）は自分のページが公開されている
 * 前提で書かれている。公開制御で準備中になるとカードが無くなり、クリック待ちで
 * タイムアウトする。リリースPRでだけ落ちる、という一番気付きにくい壊れ方をする。
 *
 * APPLY_RELEASE が無いあいだは全ページ中身が出るので常に true。
 * published に足せば自動で検査対象へ戻るので、恒久的なskipにはならない。
 *
 * 使い方:
 *   test.skip(!showsContent("/booth/"), "booth が準備中のため");
 */
export function showsContent(path: string) {
  if (process.env.APPLY_RELEASE !== "1") return true;
  if (path === "/holding/") return release.mode === "holding";

  if (release.published.includes(path)) return true;
  const section = path.split("/").filter(Boolean)[0];

  return section ? release.published.includes(`/${section}/`) : false;
}

/**
 * 全ページ共通の検査。ページごとにセレクタを列挙する運用は続かないので、
 * 「どのページでも成り立つべきこと」だけを見る。
 *
 * 検査内容:
 *  1. コンソールエラーが出ないこと
 *     → SSRとクライアントの食い違い（ハイドレーション不一致）がここで落ちる。
 *       低減設定でセクションが消えた事故は、まさにこれが出ていた
 *  2. 横スクロールが発生しないこと
 *     → 回転テープやDividerのはみ出しで何度か起きているため
 *  3. 登場演出（[data-reveal]）が最終的に全て可視になること
 *     → アニメーション低減 ON / OFF の両方で確認する
 */
async function gotoAndSettle(page: Page, path: string, reducedMotion: "reduce" | "no-preference") {
  // test.use({ reducedMotion }) はこの構成では反映されなかったため、明示的に指定する。
  // 効いているかどうかはテスト内で必ず検証すること（黙って無効化されると
  // 「常に緑だが何も検査していない」状態になる）
  await page.emulateMedia({ reducedMotion });
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  // OPスプラッシュは初回訪問時だけ全画面を覆う。検査の邪魔になるので見た扱いにする
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("op-seen", "1");
    } catch {
      /* noop */
    }
  });

  await page.goto(path, { waitUntil: "networkidle" });

  // client:visible の island を全て起こすため、最下部まで一度スクロールする
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = "auto";
    for (let y = 0; y < document.body.scrollHeight; y += 300) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);

  const applied = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  expect(applied, `prefers-reduced-motion の指定(${reducedMotion})が効いていません`).toBe(reducedMotion === "reduce");

  return consoleErrors;
}

async function assertHealthy(page: Page, consoleErrors: string[]) {
  expect(consoleErrors, "コンソールにエラーが出ています").toEqual([]);

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth, "横スクロールが発生しています").toBeLessThanOrEqual(overflow.clientWidth);

  // 「読める中身が透明になっていないか」を直接見る。
  // [data-reveal] だけを見る書き方だと、属性ごと消える壊れ方（実際に起きた）を
  // 検査対象ゼロとして素通りしてしまうため、mainの中身を総なめする。
  const invisible = await page.evaluate(() =>
    [...document.querySelectorAll("main *")]
      .filter((el) => (el.textContent ?? "").trim().length > 10)
      .filter((el) => Number(getComputedStyle(el).opacity) === 0)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`)
      .slice(0, 5),
  );
  expect(invisible, "本文が透明のまま表示されていません").toEqual([]);
}

/** SSRされたHTMLに含まれる data-reveal の数。ハイドレーション後も同数残っているべき */
async function countRevealInSsr(page: Page, path: string) {
  const res = await page.request.get(path);
  return ((await res.text()).match(/data-reveal/g) ?? []).length;
}

/**
 * 1ページぶんの検査を生成する。ページ担当者は自分のspecでこれを呼ぶだけでよい。
 *
 *   describePage("booth", "/booth/");
 */
export function describePage(name: string, path: string) {
  test.describe(name, () => {
    /* holding は mode が open になるとビルドから外れる（strip-dev-pages.mjs）。
       404を検査しても意味が無いので、そのときだけ丸ごと飛ばす。
       準備中ページ自体は検査対象に残す（Header/Footerや横スクロールは見たい） */
    test.skip(path === "/holding/" && !showsContent(path), "holding モードではないため");

    test("通常表示", async ({ page }) => {
      const errors = await gotoAndSettle(page, path, "no-preference");
      await assertHealthy(page, errors);

      // ハイドレーションで登場演出のラッパーが消えていないか
      // （消えると、サーバーが書いた opacity:0 を誰も解除できなくなる）
      const inSsr = await countRevealInSsr(page, path);
      const inDom = await page.locator("[data-reveal]").count();
      expect(inDom, `SSRでは data-reveal が ${inSsr} 個あるのにDOMでは ${inDom} 個です`).toBe(inSsr);
    });

    test.describe("アニメーション低減設定ON", () => {
      test("内容が見える", async ({ page }) => {
        const errors = await gotoAndSettle(page, path, "reduce");
        await assertHealthy(page, errors);

        const inSsr = await countRevealInSsr(page, path);
        const inDom = await page.locator("[data-reveal]").count();
        expect(inDom, `SSRでは data-reveal が ${inSsr} 個あるのにDOMでは ${inDom} 個です`).toBe(inSsr);
      });
    });
  });
}
