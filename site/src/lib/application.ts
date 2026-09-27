import type { Application } from "../types/content";

export type ApplicationStatus = "before" | "open" | "closed";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

/** "2026-09-30" → 日本時間のその日の0時（UNIXミリ秒）。実行環境のタイムゾーンに左右されない */
function startOfDayJst(date: string): number {
  return Date.parse(`${date}T00:00:00+09:00`);
}

/**
 * 受付状態の判定に使う境界。締切日は「その日の終わりまで」なので翌日0時を境にする。
 * 閲覧時にも判定し直すため、ページには数値にして埋め込む（[id].astro の data-*）
 */
export function applicationWindow(application: Application) {
  return {
    opensAt: startOfDayJst(application.opens),
    closesAt: startOfDayJst(application.closes) + DAY_MS,
  };
}

/** ビルド時（[id].astro）と閲覧時（同ページの script）で同じ判定を使うため、境界の数値だけで判定する */
export function statusAt(opensAt: number, closesAt: number, now: number): ApplicationStatus {
  if (now < opensAt) return "before";
  if (now >= closesAt) return "closed";
  return "open";
}

export function applicationStatus(application: Application, now: number): ApplicationStatus {
  const { opensAt, closesAt } = applicationWindow(application);
  return statusAt(opensAt, closesAt, now);
}

/** "2026-09-11" → "9/11(金)"。曜日は数値に分解して UTC で求める（eventDate.ts と同じ理由） */
export function formatApplicationDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = WEEKDAY_JA[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${month}/${day}(${weekday})`;
}
