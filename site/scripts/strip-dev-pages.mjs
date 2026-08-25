/**
 * 本番の成果物から、開発用ページを取り除く。
 *
 * これらを「準備中」として残すと、来場者には準備中に見えるのに実際は永久に
 * 公開されない、という嘘になる。存在しないURLとして 404 を返すのが正しい。
 *
 * 通常のビルド（PRプレビュー）では消さないので、開発中はいつでも見られる。
 */
import { rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import release from "../src/data/release.json" with { type: "json" };

if (process.env.APPLY_RELEASE !== "1") process.exit(0);

const dist = new URL("../dist/", import.meta.url);

/** 開発用の部品ギャラリー。本番導線に無く、公開する意味がない */
const targets = ["gallery"];

// ポスターページは holding 中だけ必要（CIがこれをトップに差し替える）。
// v1公開後は役目を終えるので、トップの複製を残さないよう消す
if (release.mode !== "holding") targets.push("holding");

for (const name of targets) {
  const dir = fileURLToPath(new URL(`${name}/`, dist));
  if (!existsSync(dir)) continue;
  rmSync(dir, { recursive: true, force: true });
  console.log(`[strip-dev-pages] 本番の成果物から /${name}/ を除外しました`);
}
