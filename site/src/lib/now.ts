import site from "../data/site.json";
import type { Day, Entry } from "../types/content";

const DAY_DATES: Record<Day, string> = {
  day1: site.day1Date,
  day2: site.day2Date,
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** 開催地(日本)のローカル時刻として解釈する。"HH:MM"形式でなければnull */
function toDate(day: Day, time: string): Date | null {
  if (!TIME_PATTERN.test(time)) {
    console.warn(`[now.ts] 不正な時刻フォーマットです: "${time}"（"HH:MM"形式で入力してください）`);
    return null;
  }
  return new Date(`${DAY_DATES[day]}T${time}:00+09:00`);
}

/** そのエントリが「現在進行中」かどうか（時間軸を持たないエントリ・不正な時刻は常にfalse） */
export function isEntryNow(entry: Entry, now: Date = new Date()): boolean {
  if (!entry.day || !entry.start_time || !entry.end_time) return false;
  const start = toDate(entry.day, entry.start_time);
  const end = toDate(entry.day, entry.end_time);
  if (!start || !end) return false;
  return now >= start && now <= end;
}

/** 指定locationで現在進行中のエントリを1件返す（mapページのライブ表示用） */
export function getCurrentEntry(entries: Entry[], location: string, now: Date = new Date()): Entry | null {
  return entries.find((entry) => entry.location === location && isEntryNow(entry, now)) ?? null;
}
