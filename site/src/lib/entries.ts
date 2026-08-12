import type { Category, Day, Entry, Occurrence } from "../types/content";

/** boothページの各タブ用: カテゴリで絞り込む（JSON記載順を維持） */
export function getByCategory(entries: Entry[], category: Category): Entry[] {
  return entries.filter((entry) => entry.category === category);
}

const SCHEDULABLE_CATEGORIES: Category[] = ["イベント", "ライブ"];

/**
 * 通常の日タブ（Day1/Day2）に出さない特別枠のタグ。
 * 中夜祭はday1の夜に実際に開催されるので、occurrencesには本当の日時を持たせたうえで
 * ここで除外する（以前は`day: null`にして日時を偽っていた）。
 */
const DAY_TAB_EXCLUDED_TAGS = ["中夜祭"];

/** timetableの1行ぶん。1エントリが1日に複数公演を持つため、エントリ単位では行を表せない */
export interface ScheduledSlot {
  entry: Entry;
  occurrence: Occurrence;
}

/**
 * timetableページ用: 指定の日の「イベント」「ライブ」の公演を1件ずつに展開し、start_time順に並べる。
 * 出店・学科展示も営業時間としてoccurrencesを持つが、categoryで除外してtimetableには載せない。
 * 中夜祭など特別枠のタグを持つエントリも日タブには出さない。
 */
export function getScheduledSlots(entries: Entry[], day: Day): ScheduledSlot[] {
  return entries
    .filter(
      (entry) =>
        SCHEDULABLE_CATEGORIES.includes(entry.category) &&
        !entry.tags.some((tag) => DAY_TAB_EXCLUDED_TAGS.includes(tag)),
    )
    .flatMap((entry) => entry.occurrences.map((occurrence) => ({ entry, occurrence })))
    .filter((slot) => slot.occurrence.day === day && slot.occurrence.start_time && slot.occurrence.end_time)
    .sort((a, b) => (a.occurrence.start_time ?? "").localeCompare(b.occurrence.start_time ?? ""));
}

/** timetableページ用: 常設セクション（時間軸を持たず会期中ずっと開催のエントリ） */
export function getPermanentEntries(entries: Entry[]): Entry[] {
  return entries.filter((entry) => entry.isPermanent);
}

/** home等での特別扱い（コラージュカメラ等）対象のエントリ */
export function getFeaturedEntries(entries: Entry[]): Entry[] {
  return entries.filter((entry) => entry.featured);
}
