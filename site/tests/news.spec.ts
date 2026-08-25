import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describePage } from "./_shared";

describePage("news", "/news/");

/**
 * 詳細ページは記事idを直書きすると、その記事を消したときにテストごと落ちる。
 * 実データ投入(#22等)で中身が入れ替わる前提なので、データから body を持つ最初の1件を引く。
 * src/lib/news.ts をimportすると json の import attribute で落ちるため、ファイルを直接読む。
 */
const newsJson = fileURLToPath(new URL("../src/data/news.json", import.meta.url));
const items: { id: string; body?: string }[] = JSON.parse(readFileSync(newsJson, "utf8"));
const first = items.find((item) => item.body);

if (!first) throw new Error("body を持つお知らせが無いため、詳細ページを検査できません");
describePage("news 詳細", `/news/${first.id}/`);
