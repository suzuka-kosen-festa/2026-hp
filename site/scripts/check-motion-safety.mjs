/**
 * アニメーション低減設定まわりの不変条件チェック（依存なし・1秒未満）。
 *
 * 背景: useReducedMotion() はサーバーでは端末設定を知り得ないため常に false を返す。
 * この値でマークアップを変えると、SSRとクライアントで別物を描くことになり、
 * サーバーが焼き込んだ opacity:0 が誰にも消されずセクションが不可視になる。
 * 実際にこの事故が起きた（詳細は docs/design-system.md §7）。
 *
 * ブラウザを使わないので、この検査だけでは「低減設定で本当に見えるか」までは分からない。
 * あくまで既知の踏み方を機械的に塞ぐためのもの。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src", import.meta.url));
const REPO = fileURLToPath(new URL("../..", import.meta.url));

/** マークアップ（＝SSRされるHTML）に影響するJSX属性。ここに低減フラグが出てはいけない */
const MARKUP_PROPS = ["initial", "animate", "exit", "variants", "style", "className"];

const errors = [];
const rel = (p) => relative(REPO, p);

/** `attr={` から対応する `}` までを取り出す */
function extractExpressions(source, attr) {
  const found = [];
  const needle = `${attr}={`;
  let from = 0;
  for (;;) {
    const start = source.indexOf(needle, from);
    if (start === -1) break;
    let depth = 0;
    let i = start + needle.length - 1;
    for (; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    found.push(source.slice(start, i + 1));
    from = i + 1;
  }
  return found;
}

function checkComponent(file) {
  const source = readFileSync(file, "utf8");
  const declared = source.match(/const\s+(\w+)\s*=\s*useReducedMotion\s*\(\s*\)/);
  if (!declared) return;
  const flag = declared[1];
  const flagRe = new RegExp(`\\b${flag}\\b`);

  // ① 低減フラグで早期returnしてJSXを出し分けていないか
  //    （返す要素の種類が変わると、サーバーが書いたインラインstyleを消す担当が消える）
  const earlyReturn = new RegExp(`if\\s*\\([^)]*\\b${flag}\\b[^)]*\\)\\s*\\{?\\s*return\\s*[<(]`);
  if (earlyReturn.test(source)) {
    errors.push(
      `${rel(file)}: ${flag}（useReducedMotion）で早期returnしてJSXを出し分けています。\n` +
        `    サーバーでは常にfalseになるため、SSRとクライアントで別のマークアップになります。`,
    );
  }

  // ② 低減フラグがマークアップに影響する属性に入っていないか
  for (const prop of MARKUP_PROPS) {
    for (const expr of extractExpressions(source, prop)) {
      if (flagRe.test(expr)) {
        errors.push(
          `${rel(file)}: ${prop}={...} の中で ${flag}（useReducedMotion）を参照しています。\n` +
            `    この属性はSSRされるHTMLに焼き付くため、サーバーとクライアントで食い違います。\n` +
            `    低減設定の出し分けは transition（duration）と global.css の [data-reveal] で行ってください。`,
        );
        break;
      }
    }
  }
}

/** global.css の保険が消えていないか。コンポーネント側のCSSに移すのも不可 */
function checkSafetyNet() {
  const cssPath = join(SRC, "styles/global.css");
  const css = readFileSync(cssPath, "utf8");
  const hasRule =
    /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css) &&
    /\[data-reveal\]/.test(css) &&
    /opacity:\s*1\s*!important/.test(css);
  if (!hasRule) {
    errors.push(
      `${rel(cssPath)}: [data-reveal] に対する低減設定の保険ルールが見つかりません。\n` +
        `    このルールはハイドレーション前から効く必要があるため、必ず global.css に置いてください。\n` +
        `    コンポーネント側の .css に書くと client:visible のJSチャンクに同梱され、保険になりません。`,
    );
  }
}

const files = readdirSync(SRC, { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => join(SRC, f));

for (const file of files) checkComponent(file);
checkSafetyNet();

if (errors.length > 0) {
  console.error(`\n✗ アニメーション低減設定のチェックに失敗しました（${errors.length}件）\n`);
  for (const e of errors) console.error(`  - ${e}\n`);
  console.error("  詳しい経緯と正しい書き方: docs/design-system.md §7\n");
  process.exit(1);
}

console.log(`✓ アニメーション低減設定のチェックを通過しました（.tsx ${files.length}件を検査）`);
