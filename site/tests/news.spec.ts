import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";
import { describePage } from "./_shared";

describePage("news", "/news/");

/**
 * 詳細ページは記事idを直書きすると、その記事を消したときにテストごと落ちる。
 * 実データ投入(#22等)で中身が入れ替わる前提なので、データから引く。
 *
 * draft の記事は本番ビルドで生成されないので除外する。E2E は INCLUDE_DRAFTS を
 * 渡さずにビルドするため、draft を対象にすると404で落ちる。
 *
 * src/lib/news.ts をimportすると json の import attribute で落ちるため、
 * ファイルを直接読む。
 */
const newsJson = fileURLToPath(new URL("../src/data/news.json", import.meta.url));
const items: { id: string; body?: string; draft?: boolean }[] = JSON.parse(readFileSync(newsJson, "utf8"));
const first = items.find((item) => item.body && !item.draft);

if (first) {
  describePage("news 詳細", `/news/${first.id}/`);
} else {
  // 黙って検査ゼロにならないよう、skip として残す
  test.describe("news 詳細", () => {
    test.skip("本文を持つ公開中のお知らせが無いため検査できない", () => {});
  });
}
