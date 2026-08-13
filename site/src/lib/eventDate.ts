import site from "../data/site.json";
import type { Day } from "../types/content";

/** 開催日の唯一の情報源。日付を変えるときは site.json だけを直せばよい */
export const DAY_DATES: Record<Day, string> = {
  day1: site.day1Date,
  day2: site.day2Date,
};

const WEEKDAY_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/**
 * "2026-10-31" → "10/31 SAT"。
 * ISO文字列をそのまま `new Date()` に渡すと実行環境のタイムゾーン次第で
 * 前日にずれるため、数値に分解して UTC で曜日を求める。
 */
export function formatDayLabel(day: Day): string {
  const [year, month, date] = DAY_DATES[day].split("-").map(Number);
  const weekday = WEEKDAY_EN[new Date(Date.UTC(year, month - 1, date)).getUTCDay()];
  return `${month}/${date} ${weekday}`;
}

/** 曜日の色分け用（ポスター準拠: SAT=青 / SUN=赤）。土日以外は色を付けない */
export function dayColorClass(day: Day): "sat" | "sun" | null {
  const [year, month, date] = DAY_DATES[day].split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  if (weekday === 6) return "sat";
  if (weekday === 0) return "sun";
  return null;
}
