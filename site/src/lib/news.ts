import newsData from "../data/news.json";

/**
 * NEW 判定の期間（日）。
 *
 * 例: 7 → 公開から7日以内のお知らせを NEW とする。
 */
export const NEW_THRESHOLD_DAYS = 7;

function parseDate(date: string) {
  const [year, month, day] = date.split(/[./-]/).map(Number);

  return new Date(year, month - 1, day);
}

/** 時刻を落として日付だけにする（同じ日なら差0として比べたいため） */
function toDateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * 公開日を迎えているか。
 *
 * 未来の日付のお知らせは一覧にも詳細ページにも出さない。書きかけの告知を
 * コミットしても日付が来るまでは出ない、という安全弁のための判定。
 *
 * **予約投稿ではない。** サイトは push のたびにビルドして配るので、日付が来ても
 * 誰も push しなければ出ない。公開日にリリースPRを出す運用が前提。
 *
 * 使い方:
 * isPublished(item.date)
 */
export function isPublished(date: string) {
  return toDateOnly(parseDate(date)).getTime() <= toDateOnly(new Date()).getTime();
}

/**
 * お知らせの日付を datetime 属性用の形式に変換。
 *
 * 表示用:
 * 2026.08.15
 *
 * datetime用:
 * 2026-08-15
 *
 * 使い方:
 * formatNewsDate(item.date)
 */
export function formatNewsDate(date: string) {
  return date.replaceAll(".", "-");
}

/**
 * お知らせを日付の新しい順に取得。
 *
 * 使い方:
 * const newsItems = sortNews();
 */
export function sortNews() {
  return newsData
    .filter((item) => isPublished(item.date))
    .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());
}

/**
 * お知らせを日付の新しい順に取得。
 *
 * 全件:
 * const newsItems = getNews();
 *
 * n件:
 * const latestNews = getNews(3);
 */
export function getNews(limit?: number) {
  const sorted = sortNews();

  return limit === undefined ? sorted : sorted.slice(0, limit);
}

/**
 * お知らせが NEW か判定。
 *
 * 公開から NEW_THRESHOLD_DAYS 日以内なら true。
 *
 * 使い方:
 * isNew(item.date)
 *
 * 例:
 * {isNew(item.date) && <Chip color="red">NEW</Chip>}
 */
export function isNew(date: string) {
  const publishedDate = toDateOnly(parseDate(date));
  const todayDate = toDateOnly(new Date());

  const diffDays = (todayDate.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);

  return diffDays >= 0 && diffDays <= NEW_THRESHOLD_DAYS;
}

/**
 * お知らせの遷移先。詳細ページが無いお知らせは undefined を返す。
 *
 * 詳細ページは body があるものだけ生成される（getNewsPaths）。リンクの有無を
 * 手書きの href に頼ると、body を足したのに href を書き忘れて「記事はあるのに
 * 押せない」状態になる。判定は body 側を正とし、href は外部リンク用の上書きに留める。
 *
 * 使い方:
 * const href = getNewsHref(item);
 */
export function getNewsHref(item: { id: string; href?: string; body?: string }) {
  if (item.href) return item.href;

  return item.body ? `/news/${item.id}/` : undefined;
}

/**
 * 詳細ページを生成するお知らせのパスを取得。
 *
 * body がある記事だけ対象。
 *
 * [id].astro で使用:
 * export function getStaticPaths() {
 *   return getNewsPaths();
 * }
 */
export function getNewsPaths() {
  return (
    newsData
      /* 一覧から隠れているお知らせの詳細ページだけ生き残ると、URLを直接叩けば
       読めてしまう。一覧と同じ条件で絞る */
      .filter((item) => item.body && isPublished(item.date))
      .map((item) => ({
        params: { id: item.id },
        props: { item },
      }))
  );
}
