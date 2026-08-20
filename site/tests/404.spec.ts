import { expect, test } from "@playwright/test";
import { describePage } from "./_shared";

// 中身の検査は他ページと同じ基準で。
// 存在しないURL経由で開くとブラウザが 404 をコンソールエラーとして記録してしまうため、
// ここは 404.html を直接開く（配信されるHTMLは同じもの）
describePage("404", "/404.html");

// 存在しないURLが 404 を返し、その中身が404ページであること。
// 404.html が無いと Cloudflare Pages は index.html を 200 で返す（ソフト404）ので、
// その状態に戻ったことをここで検出する
test("存在しないURLは404ページを404で返す", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist/");
  expect(res?.status(), "存在しないURLが404を返していません").toBe(404);
  await expect(page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
});
