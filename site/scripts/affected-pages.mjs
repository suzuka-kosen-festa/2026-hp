/**
 * 変更されたファイルから、検査すべきページ（specファイル）を割り出す。
 *
 * ページ単位で分担しているので、自分のページを触っただけで全ページのE2Eが走ると
 * 待ち時間が無駄になる。一方、共通部品を触った場合は全ページに影響しうるので
 * そこは横着せず全部走らせる（Reveal の事故がまさにそれで、共通部品1つで
 * 全セクションが死んだ）。
 *
 * 使い方:
 *   node scripts/affected-pages.mjs origin/main
 *   → "tests/home.spec.ts tests/entry.spec.ts" のように出力（無ければ空）
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SITE = fileURLToPath(new URL("..", import.meta.url));

/**
 * 共通部品。ここが変わったら全ページを検査する。
 * 迷ったらこちらに入れること（取りこぼすより走らせすぎるほうが安全）。
 */
const SHARED = [
  /^site\/src\/layouts\//,
  /^site\/src\/components\/(ui|motion|filter)\//,
  /^site\/src\/components\/(Header|Footer|SvgDefs)\.astro$/,
  /^site\/src\/styles\//,
  /^site\/src\/(lib|types)\//,
  /^site\/src\/data\//,
  /^site\/(package\.json|package-lock\.json|astro\.config\..*|playwright\.config\.ts)$/,
  /^site\/public\//,
  // テストの共通部分（_shared.ts 等）。個別の <page>.spec.ts はそのページ扱いにする
  /^site\/tests\/_/,
];

/**
 * ページ固有のパス → ページ名。
 * page に関数を渡すとマッチ結果からページ名を作れる。
 */
const PAGE_RULES = [
  // 自分のページのspecを足しただけで全ページ走らせない
  { pattern: /^site\/tests\/([\w-]+)\.spec\.ts$/, page: (m) => m[1] },
  { pattern: /^site\/src\/pages\/index\.astro$/, page: "home" },
  // sections/ は現状すべて home の構成要素。他ページ専用のsectionを足すときはここを分ける
  { pattern: /^site\/src\/components\/sections\//, page: "home" },
  { pattern: /^site\/src\/pages\/gallery\.astro$/, page: "gallery" },
  { pattern: /^site\/src\/pages\/entry\//, page: "entry" },
  { pattern: /^site\/src\/components\/(booth|access)\//, page: (m) => m[1] },
  // 以降、ページを追加したらここに1行足して tests/<page>.spec.ts を作る
  { pattern: /^site\/src\/pages\/booth/, page: "booth" },
  { pattern: /^site\/src\/pages\/news/, page: "news" },
  { pattern: /^site\/src\/pages\/timetable/, page: "timetable" },
  { pattern: /^site\/src\/pages\/map/, page: "map" },
  { pattern: /^site\/src\/pages\/access/, page: "access" },
  { pattern: /^site\/src\/pages\/sponsors/, page: "sponsors" },
];

const base = process.argv[2] ?? "origin/main";

let changed = [];
try {
  const out = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" });
  changed = out.split("\n").filter(Boolean);
} catch {
  // ベースが取れない環境（浅いclone等）では安全側に倒して全ページ検査する
  process.stderr.write(`[affected-pages] ${base} と比較できませんでした。全ページを検査します。\n`);
  changed = ["site/src/styles/global.css"];
}

const specFor = (page) => `tests/${page}.spec.ts`;
const allSpecs = () =>
  [...new Set(PAGE_RULES.map((r) => r.page).filter((p) => typeof p === "string"))]
    .map(specFor)
    .filter((f) => existsSync(`${SITE}${f}`));

let specs;
const sharedHit = changed.find((f) => SHARED.some((re) => re.test(f)));
if (sharedHit) {
  process.stderr.write(`[affected-pages] 共通部品が変更されています（${sharedHit}）。全ページを検査します。\n`);
  specs = allSpecs();
} else {
  const pages = new Set();
  for (const file of changed) {
    for (const { pattern, page } of PAGE_RULES) {
      const m = pattern.exec(file);
      if (m) pages.add(typeof page === "function" ? page(m) : page);
    }
  }
  specs = [...pages].map(specFor).filter((f) => existsSync(`${SITE}${f}`));
}

process.stdout.write(specs.join(" "));
