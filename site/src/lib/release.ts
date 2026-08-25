import release from "../data/release.json";

/**
 * 公開状態の唯一の情報源は src/data/release.json。
 *
 * - mode: "holding" のあいだは、CI が全URLをポスターに差し替える（.github/workflows/deploy.yml）
 * - published: 公開する静的ページのパス。ここに無いページは、実装済みでも「準備中」を出す
 *
 * ページを公開したくなったら published に1行足すだけでよい。コードは触らない。
 */
export const isHolding = release.mode === "holding";

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
 * どの記事・どの企画を出すかは published では扱わない。データ側の draft で
 * 「そもそもページを生成しない」ことで制御する（一覧からも消えるので
 * リンク切れが起きない）。
 */
export function isPublished(pathname: string) {
  const path = normalize(pathname);
  if (EXEMPT.some((exempt) => path.startsWith(exempt))) return true;

  const published = release.published as string[];
  if (published.includes(path)) return true;

  const section = path.split("/").filter(Boolean)[0];
  return section ? published.includes(`/${section}/`) : false;
}
