import type { Category, Day, Entry, Occurrence } from "../types/content";

/** boothページの各タブ用: カテゴリで絞り込む（JSON記載順を維持） */
export function getByCategory(entries: Entry[], category: Category): Entry[] {
  return entries.filter((entry) => entry.category === category);
}

const SCHEDULABLE_CATEGORIES: Category[] = ["イベント", "ライブ"];

/**
 * 通常の日タブ（Day1/Day2）に出さない特別枠のタグ。
 * 中夜祭はday1の夜に実際に開催されるので、occurrencesには本当の日時を持たせたうえで
 * ここで除外し、専用の中夜祭タブ（getChuyasaiSlots）に出す（以前は`day: null`にして日時を偽っていた）。
 */
const CHUYASAI_TAG = "中夜祭";
const DAY_TAB_EXCLUDED_TAGS = [CHUYASAI_TAG];

/**
 * 日付（Day1/Day2）の枠に入れない特別枠のエントリか。中夜祭は実際には day1 の夜に開催されるが、
 * timetable の日タブにも booth の日付の絞り込みにも出さず、「中夜祭」として別に扱う
 */
export function isOutsideDayTabs(entry: Entry): boolean {
  return entry.tags.some((tag) => DAY_TAB_EXCLUDED_TAGS.includes(tag));
}

/** timetableの1行ぶん。1エントリが1日に複数公演を持つため、エントリ単位では行を表せない */
export interface ScheduledSlot {
  entry: Entry;
  occurrence: Occurrence;
}

/** 「イベント」「ライブ」の、時刻が揃っている公演を1件ずつに展開してstart_time順に並べる */
function toSlots(entries: Entry[], day: Day): ScheduledSlot[] {
  return entries
    .filter((entry) => SCHEDULABLE_CATEGORIES.includes(entry.category))
    .flatMap((entry) => entry.occurrences.map((occurrence) => ({ entry, occurrence })))
    .filter((slot) => slot.occurrence.day === day && slot.occurrence.start_time && slot.occurrence.end_time)
    .sort((a, b) => (a.occurrence.start_time ?? "").localeCompare(b.occurrence.start_time ?? ""));
}

/**
 * timetableページ用: 指定の日の「イベント」「ライブ」の公演を1件ずつに展開し、start_time順に並べる。
 * 出店・学科展示も営業時間としてoccurrencesを持つが、categoryで除外してtimetableには載せない。
 * 中夜祭など特別枠のタグを持つエントリも日タブには出さない。
 */
export function getScheduledSlots(entries: Entry[], day: Day): ScheduledSlot[] {
  return toSlots(
    entries.filter((entry) => !isOutsideDayTabs(entry)),
    day,
  );
}

/** timetableページ用: 中夜祭タブの公演（中夜祭タグを持つエントリ。開催はday1の夜） */
export function getChuyasaiSlots(entries: Entry[]): ScheduledSlot[] {
  return toSlots(
    entries.filter((entry) => entry.tags.includes(CHUYASAI_TAG)),
    "day1",
  );
}

/** timetableページ用: 常設セクション（時間軸を持たず会期中ずっと開催のエントリ） */
export function getPermanentEntries(entries: Entry[]): Entry[] {
  return entries.filter((entry) => entry.isPermanent);
}

/**
 * timetableページ用: 常設セクションに並べる、期間中いつでも参加できるエントリ。
 * 会期中ずっとの常設（isPermanent）に加え、バザーグランプリのように参加は期間中ずっとできて
 * 発表だけがステージにある企画（period あり）も含める。後者は発表の回がグリッドにも載る
 */
export function getOngoingEntries(entries: Entry[]): Entry[] {
  return entries.filter((entry) => entry.isPermanent || entry.period);
}

/** home等での特別扱い（ミッションフォトラリー等）対象のエントリ */
export function getFeaturedEntries(entries: Entry[]): Entry[] {
  return entries.filter((entry) => entry.featured);
}
