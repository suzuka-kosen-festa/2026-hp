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

/** その回を行う場所。回ごとの指定（結果発表だけステージ等）があればそちらを優先する */
export function slotLocation({ entry, occurrence }: ScheduledSlot): string | null {
  return occurrence.location ?? entry.location;
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
 * timetableページ用: 常設セクションに並べるエントリ（データの記載順）。
 * 会期中ずっとの常設（isPermanent）に加え、バザーグランプリのように参加は期間中ずっとできて
 * 発表だけがステージにある企画（period あり）、ステージ外だが表からも辿らせたい企画
 * （listInTimetable。ゲーム大会等）を含める
 */
export function getOngoingEntries(entries: Entry[]): Entry[] {
  return entries.filter((entry) => entry.isPermanent || entry.period || entry.listInTimetable);
}

/** home等での特別扱い（ミッションフォトラリー等）対象のエントリ */
export function getFeaturedEntries(entries: Entry[]): Entry[] {
  return entries.filter((entry) => entry.featured);
}

/**
 * timetableに載せるステージ（列の並び順）。載せるのはこの列の企画だけ（requirements.md §3.5）。
 * 時刻を持っていてもステージ以外で開催する企画（ワークショップ等）は意図的に落としている
 */
export const DAY_STAGES = ["MainStage", "LiveStage", "SubStage"];
/** 中夜祭は第一体育館のライブステージとT字ステージだけで行う */
export const CHUYASAI_STAGES = ["LiveStage", "T字ステージ"];

/** timetable のタブ（日タブ／中夜祭） */
export type TimetableTabId = Day | "chuyasai";

/** その回がどのタブ・どのステージ（列）に載るか。表に載らない回は null */
function placeOf(entry: Entry, occurrence: Occurrence): { tab: TimetableTabId; stage: string } | null {
  const tab: TimetableTabId = isOutsideDayTabs(entry) ? "chuyasai" : occurrence.day;
  const stage = slotLocation({ entry, occurrence });
  const stages = tab === "chuyasai" ? CHUYASAI_STAGES : DAY_STAGES;
  return stage && stages.includes(stage) ? { tab, stage } : null;
}

/** 記事ページの「前の企画／次の企画」の1段ぶん（同じタブ・同じステージの並びの中での前後） */
export interface StageNeighbors {
  tab: TimetableTabId;
  day: Day;
  stage: string;
  prev: ScheduledSlot | null;
  next: ScheduledSlot | null;
}

/**
 * 記事ページ用: その企画の前後に同じステージで行う企画。
 *
 * つながる範囲は「timetable の同じタブ × 同じステージ」。来場者は1つのステージに居続けることが
 * 多く、知りたいのは「この次に何が出るか」なので、日をまたいだりステージをまたいだりはしない。
 * 1日目の LiveStage の昼のバンドと中夜祭の LiveStage は、表のタブどおり別の並びとして扱う。
 * 両日に出る企画（よさこい等）は、出番ごとに1段ずつ返す。表に載らない企画は空配列
 */
export function getStageNeighbors(entries: Entry[], entry: Entry): StageNeighbors[] {
  const result: StageNeighbors[] = [];
  for (const occurrence of entry.occurrences) {
    if (!occurrence.start_time || !occurrence.end_time) continue;
    const place = placeOf(entry, occurrence);
    if (!place) continue;

    const slots = (place.tab === "chuyasai" ? getChuyasaiSlots(entries) : getScheduledSlots(entries, place.tab)).filter(
      (slot) => {
        const other = placeOf(slot.entry, slot.occurrence);
        return other !== null && other.tab === place.tab && other.stage === place.stage;
      },
    );
    const index = slots.findIndex(
      (slot) => slot.entry.id === entry.id && slot.occurrence.start_time === occurrence.start_time,
    );
    if (index === -1) continue;
    result.push({
      tab: place.tab,
      day: occurrence.day,
      stage: place.stage,
      prev: slots[index - 1] ?? null,
      next: slots[index + 1] ?? null,
    });
  }
  return result;
}
