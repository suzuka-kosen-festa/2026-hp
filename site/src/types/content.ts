export type Category = "出店" | "学科展示" | "イベント" | "ライブ";
export type Day = "day1" | "day2";

export interface Entry {
  id: string;
  category: Category;
  name: string;
  group?: string | null;
  description?: string | null;
  /** 出店:飲食-フード等 / 学科展示:M科等 / イベント:day1,day2,常設 / ライブ:day1,day2,中夜祭,決勝バンド */
  tags: string[];
  /** 物理的な場所を持たない企画（コラージュカメラ等）はnull */
  location: string | null;
  image: string | null;
  /**
   * timetableページの日タブ振り分け用。出店・学科展示・常設企画はnull。
   * 中夜祭のように「開催日はあるが通常の日タブには出さない」企画もnullにする
   * （start_time/end_timeは営業時間等の情報として持ってよい。timetable掲載の可否は
   * getScheduledEntries()側でcategoryとdayの両方を見て判定する）
   */
  day?: Day | null;
  /** "HH:MM" 形式。時間指定なし・営業時間未定はnull */
  start_time?: string | null;
  end_time?: string | null;
  /** true: home等での特別扱い（バナー表示）対象 */
  featured?: boolean;
}
