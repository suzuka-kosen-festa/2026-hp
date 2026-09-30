import type { Entry, Occurrence } from "../types/content";
import booth from "../data/entries/booth.json";
import department from "../data/entries/department.json";
import program from "../data/entries/program.json";

/**
 * 出店・学科展示・イベント/ライブは担当ごとに別ファイル（同一ファイルへの同時編集を避けるため）。
 * 消費側はこの結合済み配列だけを見ればよい。
 */
type RawEntry = Omit<Entry, "occurrences"> & { occurrences?: Occurrence[] };

/**
 * 複数の企画を載せる記事（parts を持つもの）は、開催回を企画ごとに書く。
 * timetable や詳細ページの判定は Entry 直下の occurrences だけを見るので、ここで集める。
 * データ側に同じ時刻を2か所書かせると、片方だけ直す事故が起きるため
 */
function normalize(entry: RawEntry): Entry {
  if (entry.parts && entry.parts.length > 0) {
    return { ...entry, occurrences: entry.parts.flatMap((part) => part.occurrences) };
  }
  return { ...entry, occurrences: entry.occurrences ?? [] };
}

export const entries: Entry[] = ([...booth, ...department, ...program] as RawEntry[]).map(normalize);
