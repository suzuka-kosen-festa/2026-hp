import type { Entry } from "../types/content";
import { withoutDrafts } from "./draft";
import booth from "../data/entries/booth.json";
import department from "../data/entries/department.json";
import program from "../data/entries/program.json";

/**
 * 出店・学科展示・イベント/ライブは担当ごとに別ファイル（同一ファイルへの同時編集を避けるため）。
 * 消費側はこの結合済み配列だけを見ればよい。
 *
 * draft のエントリはここで落とす。一覧・timetable・トップのピックアップ・
 * /entry/<id>/ の生成まで、すべてこの配列を経由するので、消し忘れが起きない。
 */
export const entries: Entry[] = withoutDrafts([...booth, ...department, ...program] as Entry[]);
