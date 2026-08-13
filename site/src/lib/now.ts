import { DAY_DATES } from "./eventDate";
import type { Day, Entry, Occurrence } from "../types/content";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** 開催地(日本)のローカル時刻として解釈する。"HH:MM"形式でなければnull */
function toDate(day: Day, time: string): Date | null {
  if (!TIME_PATTERN.test(time)) {
    console.warn(`[now.ts] 不正な時刻フォーマットです: "${time}"（"HH:MM"形式で入力してください）`);
    return null;
  }
  return new Date(`${DAY_DATES[day]}T${time}:00+09:00`);
}

/**
 * その回が「現在進行中」かどうか（時刻を持たない回・不正な時刻は常にfalse）。
 * timetableは1行 = 1 occurrence なので、NOWバッジの判定にはエントリ単位の
 * isEntryNow() ではなくこちらを使うこと。化学マジックのように1日に複数公演ある企画で
 * isEntryNow() を使うと、進行中でない回の行にまでバッジが点いてしまう。
 */
export function isOccurrenceNow(occurrence: Occurrence, now: Date = new Date()): boolean {
  if (!occurrence.start_time || !occurrence.end_time) return false;
  const start = toDate(occurrence.day, occurrence.start_time);
  const end = toDate(occurrence.day, occurrence.end_time);
  if (!start || !end) return false;
  return now >= start && now <= end;
}

/**
 * そのエントリが「現在進行中」かどうか。
 * 1エントリが複数回の開催を持つ（両日開催・1日複数公演）ため、1回でも進行中ならtrue。
 * 時間軸を持たないエントリ（常設等）は常にfalse。
 */
export function isEntryNow(entry: Entry, now: Date = new Date()): boolean {
  return entry.occurrences.some((occurrence) => isOccurrenceNow(occurrence, now));
}

/** 指定locationで現在進行中のエントリを1件返す（mapページのライブ表示用） */
export function getCurrentEntry(entries: Entry[], location: string, now: Date = new Date()): Entry | null {
  return entries.find((entry) => entry.location === location && isEntryNow(entry, now)) ?? null;
}
