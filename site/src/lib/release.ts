import release from "../data/release.json";

/**
 * 公開状態の唯一の情報源は src/data/release.json。
 *
 *   mode      … "holding" のあいだ本番は全URLがポスター1枚。v1公開時に "open"
 *   published … 公開する静的ページ。ここに無いページは実装済みでも「準備中」を出す
 *
 * ページを公開したくなったら published に1行足すだけでよい。コードは触らない。
 */
export const isHolding = release.mode === "holding";

/**
 * published を適用するかどうか。
 *
 * 適用しないと全ページが公開扱いになる。これは実装中のページを
 * プレビューで確認するために必要。適用してしまうと、booth担当者が
 * 自分のPRのプレビューで自分の変更を見られなくなる。
 *
 *   通常のPR              … 未設定 → 全ページ公開（実装中のページが見える）
 *   release.json を触るPR … 1     → 本番と同じ状態（マージ後を事前に確認できる）
 *   本番(mainへpush)      … 1     → published どおり
 *
 * 値は .github/workflows/deploy.yml が渡す。手元では npm run build:release。
 */
export const APPLY_RELEASE = process.env.APPLY_RELEASE === "1";

/**
 * 公開判定の対象外にするページ。
 *
 * gallery … 開発用。本番導線に無く、いつでも見られてよい
 * holding … mode 専用のポスターページ。published とは無関係
 * 404     … 常に必要
 *
 * これらを published に入れる運用にすると「書き忘れて準備中になった」が起きるため、
 * 判定そのものを通さない。
 */
const EXEMPT = ["/gallery/", "/holding/", "/404"];

/** 末尾スラッシュを1つに正規化する（"/news" と "/news/" を同じものとして扱う） */
function normalize(pathname: string) {
  if (pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

/**
 * このパスを公開してよいか。
 *
 * published に書くのは「セクション」単位（"/news/" や "/entry/"）。
 * 詳細ページ（"/news/article1/" や "/entry/dept-m/"）は親セクションの
 * 公開状態を継承する。一覧が公開なのに記事が準備中、という食い違いを
 * 起こさないため。
 *
 * 個別に出したいページは完全一致でも書ける（"/entry/workshop-xxx/" など）。
 */
export function isPublished(pathname: string) {
  if (!APPLY_RELEASE) return true;

  const path = normalize(pathname);
  if (EXEMPT.some((exempt) => path.startsWith(exempt))) return true;

  const published = release.published as string[];
  if (published.includes(path)) return true;

  const section = path.split("/").filter(Boolean)[0];
  return section ? published.includes(`/${section}/`) : false;
}

/**
 * sitemap に載せてよいか。
 *
 * **本番に実在するURLだけを載せる**のが原則。実体が無いURLを申告し続けると、
 * 検索エンジンがクロールし、インデックスに残り、消えたあとも検索結果から
 * 飛ばれ続ける（実際に /booth/ で起きた）。
 *
 * ホールディング中は本番に実在するのがポスター1枚だけなので、"/" のみ。
 */
export function isInSitemap(pathname: string) {
  const path = normalize(pathname);
  if (EXEMPT.some((exempt) => path.startsWith(exempt))) return false;
  if (!APPLY_RELEASE) return isPublishedPath(path);
  if (isHolding) return path === "/";
  return isPublishedPath(path);
}

/** published の判定本体（APPLY_RELEASE の有無に関わらず published を見る） */
function isPublishedPath(path: string) {
  const published = release.published as string[];
  if (published.includes(path)) return true;
  const section = path.split("/").filter(Boolean)[0];
  return section ? published.includes(`/${section}/`) : false;
}
