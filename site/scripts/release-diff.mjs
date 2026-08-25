/**
 * release.json の変更で公開状態がどう変わるかを表にする。
 *
 * リリースは「published に1行足す」だけの小さな差分になるが、
 * 足し忘れ・書き間違いの影響は大きい（公開したはずのページが準備中のまま、など）。
 * 差分をそのまま読むより、変化を名指しで出したほうが確実に気づける。
 *
 * 使い方:
 *   node scripts/release-diff.mjs <ベースのrelease.jsonのパス>
 */
import { readFileSync } from "node:fs";

const basePath = process.argv[2];
const head = JSON.parse(readFileSync(new URL("../src/data/release.json", import.meta.url), "utf8"));
// ベース側にファイルが無い＝この仕組みを導入するPR。
// 読めても中身が空（"{}"）のことがあるので、キー単位で既定値を入れる
let parsed = {};
try {
  parsed = JSON.parse(readFileSync(basePath, "utf8"));
} catch {
  parsed = {};
}
const base = {
  mode: parsed.mode ?? head.mode,
  published: Array.isArray(parsed.published) ? parsed.published : [],
};

const lines = [];

if (base.mode !== head.mode) {
  const label = head.mode === "open" ? "本番の全URLがポスターではなくなります" : "本番の全URLがポスターになります";
  lines.push(`- **mode: \`${base.mode}\` → \`${head.mode}\`** — ${label}`);
}

const all = [...new Set([...base.published, ...head.published])].sort();
for (const path of all) {
  const was = base.published.includes(path);
  const now = head.published.includes(path);
  if (was === now) continue;
  lines.push(now ? `- \`${path}\` 準備中 → **公開**` : `- \`${path}\` 公開 → **準備中**`);
}

if (lines.length === 0) {
  console.log("公開状態に変化はありません（`release.json` は変更されていますが、`mode` と `published` は同じです）。");
} else {
  console.log("## このPRによる公開状態の変化\n");
  console.log(lines.join("\n"));
}

console.log("");
console.log(
  head.mode === "holding"
    ? "> [!NOTE]\n> `mode` は `holding` のままなので、**本番は引き続きポスター1枚**です。sitemap も `/` のみになります。"
    : "> [!WARNING]\n> `mode` が `open` です。マージすると**本番が実サイトに切り替わります**。",
);
console.log("");
console.log("プレビューURLは本番と同じ公開制御が適用された状態でビルドされています。実物で確認してください。");
