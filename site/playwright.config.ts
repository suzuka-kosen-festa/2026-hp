import { defineConfig } from "@playwright/test";

// dev サーバー(4321)と衝突しないポートでビルド成果物を配信する
const PORT = 4325;

// CI では直前の Build ステップが同じ APPLY_RELEASE で dist を作っているので、それをそのまま配信する。
// ここでもう一度ビルドすると、同じものを2回作るぶん待ち時間が延びるだけになる（deploy.yml 参照）。
// 手元では毎回ビルドする（古い dist を検査する事故を防ぐため）
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  // 1ページぶんの検査は数秒で終わる。落ちたら原因を1つずつ潰したいので retry はしない
  retries: 0,
  // GitHub Actions の ubuntu-latest（public リポジトリ）は4コア。既定（コア数の半分）だと2本しか走らない
  workers: CI ? 4 : undefined,
  reporter: CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Chromium1つに絞る。CIでのブラウザ取得を最小にするため
    browserName: "chromium",
    // スマホファーストなので375px幅で検査する（design-system.md の方針）
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    trace: "retain-on-failure",
  },
  webServer: {
    // 実際に配信されるビルド成果物を検査する（dev サーバーではなく）
    command: CI ? `npm run preview -- --port ${PORT}` : `npm run build && npm run preview -- --port ${PORT}`,
    port: PORT,
    // 使い回すと「ソースを直したのに古いビルドを検査する」事故が起きる。
    // 手元では build から毎回作り直す
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
