import { defineConfig } from "@playwright/test";

// dev サーバー(4321)と衝突しないポートでビルド成果物を配信する
const PORT = 4325;

export default defineConfig({
  testDir: "./tests",
  // 1ページぶんの検査は数秒で終わる。落ちたら原因を1つずつ潰したいので retry はしない
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
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
    command: `npm run build && npm run preview -- --port ${PORT}`,
    port: PORT,
    // 使い回すと「ソースを直したのに古いビルドを検査する」事故が起きる。
    // build は数秒なので毎回作り直す
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
