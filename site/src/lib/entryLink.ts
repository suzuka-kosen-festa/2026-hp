/**
 * `link`（外部アプリ・投票フォームへの導線）を出し始める日の扱い。
 *
 * 事前申込（lib/application.ts）とは別物なので分けている。申込は「締切で閉じる」もの、
 * こちらは「当日まで開かない」もの。バザーグランプリの投票フォームが開催前から
 * 押せてしまい、本番の集計に関係ない票が入りうる状態だったため入れた。
 *
 * 静的サイトなのでビルド時刻だけで判定すると、当日に再デプロイしない限りボタンが
 * 開かない（当日に開かないほうが実害が大きい）。判定は閲覧時にもやり直す:
 * 記事ページは pages/entry/[id].astro の script、booth / timetable の常設カードは
 * components/EntryLinkCta.tsx が受け持つ。
 */

/**
 * `link` のボタンを出してよくなる時刻（UNIXミリ秒）。
 * "2026-10-31" → 日本時間のその日の0時。実行環境のタイムゾーンに左右されない
 */
export function linkOpensAt(linkOpens: string): number {
  return Date.parse(`${linkOpens}T00:00:00+09:00`);
}

/** その時刻に `link` のボタンを出してよいか。公開日の指定が無い導線は最初から出す */
export function isLinkOpen(linkOpens: string | null | undefined, now: number): boolean {
  return !linkOpens || now >= linkOpensAt(linkOpens);
}
