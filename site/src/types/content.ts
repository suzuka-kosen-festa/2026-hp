export type Category = "出店" | "学科展示" | "イベント" | "ライブ";
export type Day = "day1" | "day2";

/**
 * 1回ぶんの開催。日をまたぐ開催は無い前提なので`day`は単数でよい。
 * timetableでは「1 Occurrence = 1行」になる（1エントリ1行ではない点に注意）。
 */
export interface Occurrence {
  day: Day;
  /** "HH:MM" 形式。終日・時間未定はnull */
  start_time: string | null;
  end_time: string | null;
  /** 「雨天中止」など回ごとの補足。timetableの行に添える */
  note?: string | null;
}

export interface Entry {
  id: string;
  category: Category;
  name: string;
  group?: string | null;
  /** バナー等の狭い場所に出す短い要約（40字目安）。長文はdescriptionへ */
  summary?: string | null;
  description?: string | null;
  /** 出店:飲食-フード等 / 学科展示:M科等 / イベント:day1,day2,常設 / ライブ:day1,day2,中夜祭,決勝バンド */
  tags: string[];
  /** 物理的な場所を持たない企画（コラージュカメラ等）はnull */
  location: string | null;
  image: string | null;
  /**
   * 開催の実体。1件 = 1回。
   * - 単発イベント: 1件
   * - 両日開催: 2件（day1 / day2）
   * - 1日に複数公演（化学マジック等）: その回数ぶん
   * - 出店・学科展示: 日ごとの営業時間を1件ずつ
   * - 常設: 空配列（+ isPermanent: true）
   * day/start_time/end_timeをEntry直下に1組だけ持つ形だと、両日開催も
   * 1日複数公演も表現できずtimetableに載せられなかったため配列にしている。
   */
  occurrences: Occurrence[];
  /** 会期中ずっと開催。trueのときoccurrencesは空にする（時間軸を持たないため） */
  isPermanent?: boolean;
  /** 参加型企画の対象者（例:「小学生(中学年〜高学年)と保護者」） */
  audience?: string | null;
  /** 定員。「各回10組」のような回単位の表現も許すため数値ではなく文字列 */
  capacity?: string | null;
  /** ※付きで並べる注意書き。descriptionの自由文に混ぜず構造化して持つ */
  notes?: string[];
  /** true: home等での特別扱い（バナー表示）対象 */
  featured?: boolean;
}
