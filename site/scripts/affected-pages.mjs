/**
 * 変更されたファイルから、検査すべきページ（specファイル）を割り出す。
 *
 * ページ単位で分担しているので、自分のページを触っただけで全ページのE2Eが走ると
 * 待ち時間が無駄になる。一方、共通部品を触った場合は全ページに影響しうるので
 * そこは横着せず全部走らせる（Reveal の事故がまさにそれで、共通部品1つで
 * 全セクションが死んだ）。
 *
 * 以前は「パス → ページ」の対応を手で書いていたが、足し忘れでテストが素通りする事故が
 * 何度も起きたうえ、データJSONや public/ の1行修正でも全ページ走っていた。
 * いまは src/ の import をたどって「そのファイルを使っているページ」を自動で求める。
 *
 *   1. src/ と tests/ の import を読んで「誰が誰を使っているか」の逆引き表を作る
 *      （静的 import / import() / ?raw・?url / CSS の @import・url() / import.meta.glob /
 *        new URL("…", import.meta.url)。正規表現で拾うだけなので外部依存は無い）
 *   2. 変更ファイルから逆向きにたどり、到達した src/pages/** をページ名に直す
 *      （pages/index.astro → home、pages/map/game.astro → map-game と map）
 *   3. tests/<page>.spec.ts を変えたらそのページ
 *   4. public/ のファイルは、src/ や tests/ の中でそのURL（/files/xxx.webp）を
 *      文字列で書いているファイルからたどる。どこにも書かれていなければ全ページ
 *   5. 他のページを page.goto で開いて検査している spec も1段だけ足す
 *      （map.spec は /timetable/ の「MAPに戻る」を、sponsors.spec は /news/ のリンクを見ている）
 *   6. tests/_shared.ts は全specが import するので、宣言（関数）単位でつなぐ。
 *      gatedLinkEntries が読む entries/*.json を変えても、それを import した spec だけが走る
 *
 * spec 名は src/pages/ のパスから決まるので、ページを足しても登録は要らない（spec を置くだけ）。
 * たどれないものは安全側に倒して全ページにする（取りこぼすより走らせすぎるほうが安全）。
 * どのファイルがどのページに当たったかは stderr に出すので、CIログで追える。
 *
 * 使い方:
 *   node scripts/affected-pages.mjs origin/main
 *   node scripts/affected-pages.mjs --files site/src/data/news.json,site/public/ogp.png
 *   → "tests/home.spec.ts tests/news.spec.ts" のように出力（無ければ空）
 *   パスはリポジトリ直下からの相対（git diff --name-only と同じ形）
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_SITE = fileURLToPath(new URL("..", import.meta.url));

/**
 * 変わったら全ページを検査するファイル。
 * import をたどっても全ページに届くもの（layouts/ など）もあるが、「全ページに出る部品」は
 * 見た目の上でも全ページに効くので、ここで明示しておく。
 * 迷ったらこちらに入れること（取りこぼすより走らせすぎるほうが安全）。
 */
const SHARED = [
  /^site\/src\/layouts\//,
  /^site\/src\/styles\//,
  /^site\/src\/components\/(Header|Footer|SvgDefs)\.astro$/,
  // 公開制御。全ページの表示可否が変わるうえ、tests/release.spec.ts はページの import を
  // たどっても出てこないので、ここで全ページ（release.spec を含む）にする
  /^site\/src\/data\/release\.json$/,
  /^site\/src\/lib\/release\.ts$/,
  // Astro がファイル名で特別扱いするもの。import されなくても全ページに効く
  /^site\/src\/(middleware|content\.config)\.[jt]s$/,
  /^site\/src\/content\//,
  /^site\/src\/env\.d\.ts$/,
  // ビルド・テストの設定
  /^site\/(package\.json|package-lock\.json|\.npmrc|tsconfig\.json|astro\.config\..*|playwright\.config\.ts)$/,
  /^\.node-version$/,
  /^\.github\/workflows\/deploy\.yml$/,
  // ビルドの後処理（npm run build の一部）
  /^site\/scripts\/strip-dev-pages\.mjs$/,
  // テストの共通部分（_shared.ts 等）。個別の <page>.spec.ts はそのページ扱いにする
  /^site\/tests\/(?![\w-]+\.spec\.ts$)/,
];

/**
 * import をたどった先がここに着いたら全ページ。
 * astro.config は sitemap の判定などで src/ のコードを読むので、そこから先はページ単位に分けられない。
 */
const GRAPH_SINKS = [/^site\/astro\.config\.[cm]?[jt]s$/];

/** import の解決で試す拡張子（Vite と同じく、拡張子を省略した import を許す） */
const EXTS = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".astro", ".json", ".css"];
/** import を読み取るファイル */
const CODE_EXT = /\.(astro|[cm]?[jt]sx?|css)$/;
/** public/ の URL を探すファイル（JSONのデータに /files/xxx.webp と書く使い方がある） */
const TEXT_EXT = /\.(astro|[cm]?[jt]sx?|css|json)$/;

const toPosix = (p) => p.split(path.sep).join("/");

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** グロブ（* / ** / ? / {a,b}）を正規表現にする。否定（!）は無視する＝広めに当てる */
function globToRegExp(glob) {
  let re = "";
  let braces = 0;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        const slash = glob[i + 2] === "/";
        re += slash ? "(?:.*/)?" : ".*";
        i += slash ? 2 : 1;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (c === "{") (braces++, (re += "(?:"));
    else if (c === "}" && braces > 0) (braces--, (re += ")"));
    else if (c === "," && braces > 0) re += "|";
    else if (c === "[" || c === "]") re += c;
    else re += c.replace(/[.+^$(){}|\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/** tsconfig の paths（"@/*": ["src/*"] など）。コメントと末尾カンマを許して読む */
function readAliases(site) {
  const file = path.join(site, "tsconfig.json");
  if (!existsSync(file)) return [];
  try {
    const text = readFileSync(file, "utf8")
      .replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (_, s) => s ?? "")
      .replace(/,(\s*[}\]])/g, "$1");
    const { compilerOptions = {} } = JSON.parse(text);
    const base = path.join(site, compilerOptions.baseUrl ?? ".");
    return Object.entries(compilerOptions.paths ?? {}).map(([key, targets]) => ({
      prefix: key.replace(/\*$/, ""),
      wildcard: key.endsWith("*"),
      targets: targets.map((t) => path.join(base, t.replace(/\*$/, ""))),
    }));
  } catch {
    return [];
  }
}

/**
 * import グラフを作る。
 * 戻り値の dependents は「キーのファイルを使っているファイル」の集合。
 * globs は import.meta.glob など「パターンで読むもの」で、パターンに合うファイルが
 * 増減・変更されると owner が変わる。
 */
export function buildGraph(site) {
  const repo = path.dirname(path.resolve(site));
  const rel = (abs) => toPosix(path.relative(repo, abs));
  const aliases = readAliases(site);

  const roots = [path.join(site, "src"), path.join(site, "tests")];
  const files = roots.flatMap((r) => walk(r));
  for (const name of readdirSync(site)) if (/^astro\.config\./.test(name)) files.push(path.join(site, name));

  const dependents = new Map();
  const globs = [];
  /** 解決できなかった import を持つファイル（エイリアスの足し忘れ等）。どの変更でも検査に含める */
  const unresolved = new Map();
  const texts = new Map();

  const addEdge = (from, to) => {
    if (!dependents.has(to)) dependents.set(to, new Set());
    dependents.get(to).add(from);
  };

  const tryFile = (p) => {
    if (existsSync(p) && statSync(p).isFile()) return p;
    for (const ext of EXTS) if (existsSync(p + ext)) return p + ext;
    // TS の慣習で "./foo.js" と書いて foo.ts を指す書き方
    const js = /\.(m?)jsx?$/.exec(p);
    if (js) for (const ext of [".ts", ".tsx", ".mts"]) if (existsSync(p.replace(/\.m?jsx?$/, ext))) return p.replace(/\.m?jsx?$/, ext);
    if (existsSync(p) && statSync(p).isDirectory()) {
      for (const ext of EXTS) if (existsSync(path.join(p, `index${ext}`))) return path.join(p, `index${ext}`);
    }
    return null;
  };

  /** 指定子 → 絶対パス。外部パッケージは "external"、解決できなければ null */
  const resolve = (spec, fromDir) => {
    spec = spec.replace(/[?#].*$/, "");
    if (!spec) return "external";
    if (spec.startsWith(".")) return tryFile(path.resolve(fromDir, spec));
    if (spec.startsWith("/")) return tryFile(path.join(site, spec)); // Vite のルート相対
    for (const a of aliases) {
      if (a.wildcard ? spec.startsWith(a.prefix) : spec === a.prefix) {
        for (const t of a.targets) {
          const hit = tryFile(a.wildcard ? path.join(t, spec.slice(a.prefix.length)) : t);
          if (hit) return hit;
        }
        return null;
      }
    }
    // ~/x や @/x、#x はエイリアスとしか読めない。解決できないなら取りこぼしの恐れがある
    if (/^(~|@\/|#)/.test(spec)) return null;
    return "external"; // astro:assets、react、@fontsource/... など
  };

  /** 静的な部分だけのパス（テンプレート文字列の ${} より前）をグロブにする */
  const addPrefixGlob = (owner, fromDir, prefix) => {
    const abs = path.resolve(fromDir, prefix);
    const dirLike = prefix.endsWith("/") || (existsSync(abs) && statSync(abs).isDirectory());
    const pattern = toPosix(path.relative(repo, abs)) + (dirLike ? "/**" : "*");
    globs.push({ owner, re: globToRegExp(pattern), pattern });
  };

  /** spec を解決して from → 解決先 の辺を張る。from はファイル、または「ファイル#宣言名」 */
  const handleSpec = (file, from, spec, { prefixOk = false } = {}) => {
    const dir = path.dirname(file);
    if (spec.includes("${")) {
      const prefix = spec.slice(0, spec.indexOf("${"));
      if (prefix.startsWith(".")) addPrefixGlob(from, dir, prefix);
      else if (!/^[a-z]/i.test(prefix)) unresolved.set(from, spec);
      return;
    }
    if (/^(data:|https?:|\/\/|#)/.test(spec)) return;
    const target = resolve(spec, dir);
    if (target === "external") return;
    if (target) return addEdge(from, rel(target));
    // new URL("../src/data/entries/", import.meta.url) のようにディレクトリを指すもの
    const abs = path.resolve(dir, spec.replace(/[?#].*$/, ""));
    if (prefixOk && spec.startsWith(".") && existsSync(abs) && statSync(abs).isDirectory()) {
      return addPrefixGlob(from, dir, spec.endsWith("/") ? spec : `${spec}/`);
    }
    unresolved.set(from, spec);
  };

  /** text（ファイル全体、またはその一部）の中の参照を from から張る */
  const scan = (file, from, text) => {
    if (!file.endsWith(".css")) {
      // import x from "…" / export … from "…"（複数行の import も from の位置で拾う）
      for (const m of text.matchAll(/\bfrom\s*(['"])([^'"\n]+)\1/g)) handleSpec(file, from, m[2]);
      // import "./x.css"
      for (const m of text.matchAll(/\bimport\s*(['"])([^'"\n]+)\1/g)) handleSpec(file, from, m[2]);
      // import("…") / import(`…${x}`)
      for (const m of text.matchAll(/\bimport\s*\(\s*(?:(['"])([^'"\n]+)\1|`([^`]*)`)/g)) handleSpec(file, from, m[2] ?? m[3]);
      // new URL("…", import.meta.url)（tests が src/data を直接読むのもこの形）
      for (const m of text.matchAll(/new\s+URL\(\s*(?:(['"])([^'"\n]+)\1|`([^`]*)`)\s*,\s*import\.meta\.url/g)) {
        handleSpec(file, from, m[2] ?? m[3], { prefixOk: true });
      }
      // import.meta.glob("…") / import.meta.glob(["…", "…"]) / Astro.glob("…")
      for (const m of text.matchAll(/(?:import\.meta\.glob|Astro\.glob)\s*(?:<[^>]*>)?\s*\(\s*(\[[^\]]*\]|(['"`])[^'"`]+\2)/g)) {
        for (const s of m[1].matchAll(/(['"`])([^'"`]+)\1/g)) {
          const pattern = s[2];
          if (pattern.startsWith("!")) continue;
          const abs = pattern.startsWith("/") ? path.join(site, pattern) : path.resolve(path.dirname(file), pattern);
          const relPattern = toPosix(path.relative(repo, abs));
          globs.push({ owner: from, re: globToRegExp(relPattern), pattern: relPattern });
        }
      }
      // <script src="./x.ts">（Astro が処理する相対パスのみ）
      for (const m of text.matchAll(/<script\b[^>]*\bsrc=(['"])(\.[^'"]+)\1/g)) handleSpec(file, from, m[2]);
    }
    // CSS（.css と .astro の <style>）: @import と相対パスの url()
    for (const m of text.matchAll(/@import\s+(?:url\(\s*)?(['"]?)([^'")\s;]+)\1/g)) handleSpec(file, from, m[2]);
    for (const m of text.matchAll(/url\(\s*(['"]?)(\.\.?\/[^'")]+)\1\s*\)/g)) handleSpec(file, from, m[2]);
  };

  /**
   * テストの共通ヘルパー（tests/_shared.ts）は全specが import するので、ファイル単位でつなぐと
   * 「ヘルパーの1関数が読むデータ」を変えただけで全specが走ってしまう。
   * ヘルパーだけはトップレベルの宣言ごとに分け、spec が名前で import した宣言だけをつなぐ。
   */
  const helperDecls = new Map(); // helper → 宣言名の配列
  const scanHelper = (file, text) => {
    const id = rel(file);
    const declRe = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
    const starts = [...text.matchAll(declRe)].map((m) => ({ name: m[1], index: m.index }));
    scan(file, id, text.slice(0, starts[0]?.index ?? text.length));
    const names = starts.map((d) => d.name);
    helperDecls.set(id, names);
    starts.forEach((d, i) => {
      const body = text.slice(d.index, starts[i + 1]?.index ?? text.length);
      const node = `${id}#${d.name}`;
      scan(file, node, body);
      // 宣言の外に出た文（読み込んだだけで走る処理）がありそうなら、ファイル全体の扱いにする
      const loose = body.split("\n").slice(1).some((l) => /^[^\s}\])/*]/.test(l));
      if (loose) addEdge(id, node);
      // 同じファイルの別の宣言を使っていれば、その宣言にも依存する
      for (const other of names) if (other !== d.name && new RegExp(`\\b${other}\\b`).test(body)) addEdge(node, `${id}#${other}`);
    });
  };
  const isHelper = (f) => /^site\/tests\/_[^/]*\.[cm]?[jt]s$/.test(f);

  for (const file of files) {
    if (!TEXT_EXT.test(file)) continue;
    const text = readFileSync(file, "utf8");
    texts.set(rel(file), text);
    if (!CODE_EXT.test(file)) continue;
    if (isHelper(rel(file))) scanHelper(file, text);
    else scan(file, rel(file), text);
  }

  // ヘルパーを import している側を、import した名前の宣言へつなぐ
  for (const file of files) {
    const text = texts.get(rel(file));
    if (!text || !CODE_EXT.test(file)) continue;
    for (const m of text.matchAll(/\bimport\s+([^'";]*?)\s*from\s*(['"])([^'"\n]+)\2/g)) {
      const target = resolve(m[3], path.dirname(file));
      if (!target || target === "external" || !isHelper(rel(target))) continue;
      const helper = rel(target);
      const named = /\{([^}]*)\}/.exec(m[1]);
      const whole = !named || /^\s*[\w$]+\s*,|\*/.test(m[1].replace(/\{[^}]*\}/, ""));
      const names = whole
        ? helperDecls.get(helper) ?? []
        : named[1].split(",").map((n) => n.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]).filter(Boolean);
      for (const n of names) addEdge(rel(file), `${helper}#${n}`);
    }
  }

  return { repo, dependents, globs, unresolved, texts };
}

/** pages/ のファイル → spec 名の候補。map/game は map-game と map の両方 */
function specNamesForPage(file) {
  const route = file
    .replace(/^site\/src\/pages\//, "")
    .replace(/\.(astro|md|mdx|html|[cm]?[jt]s)$/, "")
    .replace(/(^|\/)index$/, "");
  if (route === "") return ["home"];
  const segs = route.split("/");
  return segs.map((_, i) => segs.slice(0, i + 1).join("-"));
}

/**
 * @param {string[]} changed リポジトリ直下からの相対パス
 * @param {{ site?: string, log?: (msg: string) => void }} [opts]
 * @returns {string[]} "tests/<page>.spec.ts" の配列
 */
export function affectedSpecs(changed, { site = DEFAULT_SITE, log = () => {} } = {}) {
  const specFor = (page) => `tests/${page}.spec.ts`;
  const hasSpec = (page) => existsSync(path.join(site, specFor(page)));
  const allSpecs = () =>
    readdirSync(path.join(site, "tests"))
      .filter((f) => /^[\w-]+\.spec\.ts$/.test(f))
      .sort()
      .map((f) => `tests/${f}`);

  const short = (f) => f.replace(/^site\/src\//, "").replace(/^site\//, "");
  let graph;
  const getGraph = () => (graph ??= buildGraph(site));

  const pages = new Set();
  /** spec を直しただけのもの。ページは変わっていないので、他の spec へは広げない */
  const specEdits = new Set();
  const warned = new Set();
  const all = (file, why) => {
    log(`${file} → 全ページ（${why}）`);
    return true;
  };

  const run = () => {
    for (const file of changed) {
      if (SHARED.some((re) => re.test(file))) return all(file, "共通部分");

      const spec = /^site\/tests\/([\w-]+)\.spec\.ts$/.exec(file);
      if (spec) {
        log(`${file} → ${spec[1]}（spec自身の変更）`);
        specEdits.add(spec[1]);
        continue;
      }

      const g = getGraph();
      /** たどり始めるファイル → 理由 */
      const starts = new Map();
      if (/^site\/public\//.test(file)) {
        const url = file.replace(/^site\/public\//, "");
        const needles = [...new Set([url, encodeURI(url)])];
        for (const [f, text] of g.texts) if (needles.some((n) => text.includes(n))) starts.set(f, `"/${url}" を参照`);
        if (starts.size === 0) return all(file, `"/${url}" を文字列で参照しているファイルが src/・tests/ に無い。組み立てたURLで使っている可能性があるため`);
      } else if (/^site\/(src|tests)\//.test(file)) {
        if (!existsSync(path.join(g.repo, file))) {
          // 消したファイルの元の参照元は今の木からは分からない（グロブで読まれていたものは下で拾える）
          const globbed = g.globs.filter((x) => x.re.test(file));
          if (globbed.length === 0) return all(file, "削除されたファイルで、元の参照元をたどれないため");
        }
        starts.set(file, null);
      } else {
        log(`${file} → なし（ビルドにもテストにも関わらない）`);
        continue;
      }

      // 逆向きにたどる。prev は経路の表示用
      const prev = new Map([...starts.keys()].map((f) => [f, null]));
      const queue = [...starts.keys()];
      const hit = new Map(); // page → 到達したページファイル
      while (queue.length) {
        const cur = queue.shift();
        if (GRAPH_SINKS.some((re) => re.test(cur))) return all(file, `${short(cur)} から読まれているため`);
        if (/^site\/src\/pages\//.test(cur)) {
          for (const name of specNamesForPage(cur)) if (!hit.has(name)) hit.set(name, cur);
        }
        const tspec = /^site\/tests\/([\w-]+)\.spec\.ts$/.exec(cur);
        if (tspec && !hit.has(tspec[1])) hit.set(tspec[1], cur);

        const next = new Set(g.dependents.get(cur) ?? []);
        for (const x of g.globs) if (x.re.test(cur)) next.add(x.owner);
        for (const n of next) {
          if (prev.has(n)) continue;
          prev.set(n, cur);
          queue.push(n);
        }
      }

      // 解決できない import を持つファイルは、何に依存しているか分からないので常に含める
      for (const [f, spec] of g.unresolved) {
        if (!warned.has(f)) {
          warned.add(f);
          log(`（注意）${short(f)} の import "${spec}" を解決できません。どの変更でもこのファイルの影響先を検査します`);
        }
        for (const n of specNamesFromFile(g, f)) if (!hit.has(n)) hit.set(n, f);
      }

      const found = [...hit.entries()].filter(([name]) => hasSpec(name));
      if (found.length === 0) {
        log(`${file} → なし（どのページからも使われていない）`);
        continue;
      }
      for (const [name, via] of found) {
        const chain = [];
        for (let c = via; c; c = prev.get(c)) chain.unshift(c);
        const note = starts.get(chain[0]);
        log(`${file} → ${name}（${chain.map(short).join(" → ")}${note ? `、${note}` : ""}）`);
        pages.add(name);
      }
    }
    return false;
  };

  if (run()) return allSpecs();

  // 他のページを開いて検査する spec も走らせる（map.spec が /timetable/ の「MAPに戻る」を、
  // sponsors.spec が /news/ のリンクを見ている、など）。page.goto に書いたURLだけを見る
  // 1段だけ広げる（広げた先からさらに広げると、ほぼ全ページになってしまう）
  const direct = new Set(pages);
  if (direct.size > 0) {
    for (const [spec, visited] of specVisits(site)) {
      if (direct.has(spec)) continue;
      const via = [...visited].find((p) => direct.has(p));
      if (!via) continue;
      log(`${spec} も検査（tests/${spec}.spec.ts が ${via} のページを開いて検査しているため）`);
      pages.add(spec);
    }
  }
  return [...new Set([...pages, ...specEdits])].filter(hasSpec).sort().map(specFor);
}

/** spec 名 → その spec が page.goto で開くページ名の集合 */
function specVisits(site) {
  const out = new Map();
  const dir = path.join(site, "tests");
  for (const f of readdirSync(dir)) {
    const m = /^([\w-]+)\.spec\.ts$/.exec(f);
    if (!m) continue;
    const text = readFileSync(path.join(dir, f), "utf8");
    const visited = new Set();
    for (const g of text.matchAll(/\.goto\(\s*(['"`])([^'"`]*)/g)) {
      let url = g[2].replace(/^https?:\/\/[^/]+/, "");
      if (url.includes("${")) url = url.slice(0, url.indexOf("${")).replace(/[^/]*$/, "");
      if (!url.startsWith("/")) continue;
      const route = url.replace(/[?#].*$/, "").replace(/^\/|\/$/g, "");
      if (route === "") {
        // "/" そのもの。テンプレートの前半だけが "/" のもの（`/${x}`）は行き先が分からないので数えない
        if (!g[2].includes("${")) visited.add("home");
        continue;
      }
      for (const name of specNamesForPage(`site/src/pages/${route}.astro`)) visited.add(name);
    }
    out.set(m[1], visited);
  }
  return out;
}

/** あるファイルから逆向きにたどって当たるページ名（unresolved の扱い用） */
function specNamesFromFile(g, start) {
  const seen = new Set([start]);
  const queue = [start];
  const names = new Set();
  while (queue.length) {
    const cur = queue.shift();
    if (/^site\/src\/pages\//.test(cur)) for (const n of specNamesForPage(cur)) names.add(n);
    const t = /^site\/tests\/([\w-]+)\.spec\.ts$/.exec(cur);
    if (t) names.add(t[1]);
    const next = new Set(g.dependents.get(cur) ?? []);
    for (const x of g.globs) if (x.re.test(cur)) next.add(x.owner);
    for (const n of next) if (!seen.has(n)) (seen.add(n), queue.push(n));
  }
  return names;
}

// ---- CLI ----
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const log = (msg) => process.stderr.write(`[affected-pages] ${msg}\n`);
  let changed;
  const fi = args.indexOf("--files");
  if (fi !== -1) {
    changed = (args[fi + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    const base = args[0] ?? "origin/main";
    try {
      const out = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" });
      changed = out.split("\n").filter(Boolean);
    } catch {
      // ベースが取れない環境（浅いclone等）では安全側に倒して全ページ検査する
      log(`${base} と比較できませんでした。全ページを検査します。`);
      changed = ["site/src/styles/global.css"];
    }
  }
  process.stdout.write(affectedSpecs(changed, { log }).join(" "));
}
