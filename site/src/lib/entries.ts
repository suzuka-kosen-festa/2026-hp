import type { Category, Day, Entry } from "../types/content";

/** boothページの各タブ用: カテゴリで絞り込む（JSON記載順を維持） */
export function getByCategory(entries: Entry[], category: Category): Entry[] {
  return entries.filter((entry) => entry.category === category);
}

const SCHEDULABLE_CATEGORIES: Category[] = ["イベント", "ライブ"];

/**
 * timetableページ用: 指定の日に時間指定のある「イベント」「ライブ」エントリのみ、start_time順に並べる。
 * 出店・学科展示は営業時間として start_time/end_time を持つことがあるが、timetableには載せない。
 */
export function getScheduledEntries(entries: Entry[], day: Day): Entry[] {
  return entries
    .filter(
      (entry) =>
        SCHEDULABLE_CATEGORIES.includes(entry.category) && entry.day === day && entry.start_time && entry.end_time,
    )
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
}

/** timetableページ用: 常設セクション（時間軸を持たず、常設タグを持つエントリ） */
export function getPermanentEntries(entries: Entry[]): Entry[] {
  return entries.filter((entry) => !entry.start_time && entry.tags.includes("常設"));
}

/** home等での特別扱い（コラージュカメラ等）対象のエントリ */
export function getFeaturedEntries(entries: Entry[]): Entry[] {
  return entries.filter((entry) => entry.featured);
}
