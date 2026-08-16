import newsData from "../data/news.json";

/**
 * NEW 判定の期間（日）。
 *
 * 例: 7 → 公開から7日以内のお知らせを NEW とする。
 */
export const NEW_THRESHOLD_DAYS = 7;

function parseDate(date: string) {
  const [year, month, day] = date.split(".").map(Number);

  return new Date(year, month - 1, day);
}

/**
 * お知らせを日付の新しい順に取得。
 *
 * 使い方:
 * const newsItems = sortNews();
 */
export function sortNews() {
  return [...newsData].sort(
    (a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime(),
  );
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
  const publishedAt = parseDate(date);
  const today = new Date();

  const publishedDate = new Date(
    publishedAt.getFullYear(),
    publishedAt.getMonth(),
    publishedAt.getDate(),
  );

  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const diffDays =
    (todayDate.getTime() - publishedDate.getTime()) /
    (1000 * 60 * 60 * 24);

  return diffDays >= 0 && diffDays <= NEW_THRESHOLD_DAYS;
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
  return newsData
    .filter((item) => item.body)
    .map((item) => ({
      params: { id: item.id },
      props: { item },
    }));
}
