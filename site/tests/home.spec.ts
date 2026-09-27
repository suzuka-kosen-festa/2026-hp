import { expect, test } from "@playwright/test";
import { describePage } from "./_shared";

describePage("home", "/");

// 画像が無い企画は写真枠ごと省く（詳細ページと揃える。Issue #60）。
// 実データに画像が入っても成り立つ検査なので、データ待ちで無効化されることはない。
test("PICK UP に NO IMAGE のプレースホルダーが出ない", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("NO IMAGE")).toHaveCount(0);
});

test("初回訪問では1桁につき24枚の紙片で日数を作るOPを表示する", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-11T00:00:00+09:00"));
  await page.addInitScript(() => sessionStorage.setItem("op-variant", "current"));
  await page.goto("/");

  const splash = page.getByLabel("開催まであと50日");
  await expect(splash).toBeVisible();
  await expect(splash.locator(".op-paper-placement")).toHaveCount(48);
  await expect(splash.locator("video")).toHaveCount(0);
});

test("OPをスキップすると同じセッションでは再表示しない", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "SKIP" }).click();

  await expect(page.locator(".op-splash")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".op-splash")).toHaveCount(0);
});

test("保存されたOPを初回表示と再再生で使い続ける", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("op-variant", "candidate1"));
  await page.goto("/");

  await expect(page.locator(".op-splash")).toHaveAttribute("data-op-variant", "candidate1");
  await page.getByRole("button", { name: "SKIP" }).click();
  await expect(page.locator(".op-splash")).toHaveCount(0);

  await page.evaluate(() => window.dispatchEvent(new Event("op:replay")));
  await expect(page.locator(".op-splash")).toHaveAttribute("data-op-variant", "candidate1");
});

test("再生途中の再再生でも最初に選んだ演出と新しい終了時刻を使う", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("op-variant", "candidate1"));
  await page.goto("/");
  await expect(page.locator(".op-splash")).toHaveAttribute("data-op-variant", "candidate1");
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.dispatchEvent(new Event("op:replay")));
  await page.waitForTimeout(1900);
  await expect(page.locator(".op-splash")).toHaveAttribute("data-op-variant", "candidate1");
  await expect(page.locator(".op-splash")).toHaveCount(0, { timeout: 2500 });
});

test("低減モーションでは初回OPを省略し、明示的な再再生はできる", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => sessionStorage.setItem("op-variant", "candidate2"));
  await page.goto("/");
  await expect(page.locator("#op-cover")).toHaveCount(0);
  await expect(page.locator(".op-splash")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("op:replay")));
  await expect(page.locator(".op-splash")).toHaveAttribute("data-op-variant", "candidate2");
});

test("データ節約回線では初回OPを省略する", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { value: { saveData: true } }));
  await page.goto("/");
  await expect(page.locator("#op-cover")).toHaveCount(0);
  await expect(page.locator(".op-splash")).toHaveCount(0);
});

test("未知の保存値は有効なOPに選び直す", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("op-variant", "unknown"));
  await page.goto("/");
  await expect(page.locator(".op-splash")).toHaveAttribute("data-op-variant", /^(current|candidate1|candidate2)$/);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("op-variant"))).toMatch(/^(current|candidate1|candidate2)$/);
});

for (const [value, expected] of [[0, "current"], [0.5, "candidate1"], [0.99, "candidate2"]] as const) {
  test(`抽選値${value}では${expected}を選ぶ`, async ({ page }) => {
    await page.addInitScript((randomValue) => { Math.random = () => randomValue; }, value);
    await page.goto("/");
    await expect(page.locator(".op-splash")).toHaveAttribute("data-op-variant", expected);
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("op-variant"))).toBe(expected);
  });
}

test("候補1は紙片の数字からロゴを組み立てて終了する", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-11T00:00:00+09:00"));
  await page.addInitScript(() => sessionStorage.setItem("op-variant", "candidate1"));
  await page.goto("/");
  const splash = page.locator(".op-splash");
  await expect(splash.locator(".op-candidate1 .digit-piece")).toHaveCount(8);
  await expect(splash.locator(".op-candidate1 .logo-piece")).toHaveCount(7);
  await expect(splash).toHaveCount(0, { timeout: 6000 });
});

test("候補2は学科柄と黄色いワイプからロゴへ切り替わる", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("op-variant", "candidate2"));
  await page.goto("/");
  const splash = page.locator(".op-splash");
  await expect(splash.locator(".op-candidate2 .opening-paper")).toHaveCount(3);
  await expect(splash.locator(".op2-third circle")).toHaveCount(6);
  await expect(splash.locator(".op-candidate2 .op2-wipe")).toHaveCount(1);
  await expect.poll(() => splash.locator(".op2-wipe").evaluate(el => {
    const progress = el.getAnimations()[0]?.currentTime;
    if (typeof progress !== "number" || progress < 3300) return null;
    return Number(getComputedStyle(document.querySelector(".op2-hero")!).opacity);
  }), { timeout: 5000 }).toBe(1);
  await expect(splash).toHaveCount(0, { timeout: 6500 });
});
