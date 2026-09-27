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

/**
 * 事前申込（I科ワークショップ等。Issue #96）。
 *
 * `link` とは分けて持つ。`link` は「その場で遊べる外部アプリ」への導線で、
 * 「やってみる」ボタンや booth / timetable の常設CTAにも使われている。
 * 申込には締切があり、過ぎたらボタンを閉じる必要があるので意味が違う。
 */
export interface Application {
  /** 申込フォームのURL（外部サイト。別タブで開く） */
  url: string;
  /** 受付開始日 "YYYY-MM-DD"（日本時間のこの日の0時から） */
  opens: string;
  /** 締切日 "YYYY-MM-DD"（日本時間のこの日の終わりまで受け付ける） */
  closes: string;
  /** 主催側の募集要項ページ。問い合わせ先などはこちらを見てもらう */
  guideUrl?: string | null;
}

/**
 * 出演者1人（バンドのメンバー等）。
 * 出席番号は名簿にはあるが**公開ページに出さない**ので持たない。
 */
export interface Member {
  name: string;
  /** 他校からの参加者の所属（例:「亀山高校」）。本校生は省略 */
  affiliation?: string | null;
}

export interface Entry {
  id: string;
  category: Category;
  /**
   * 画面に出すカテゴリ名。省略時は category をそのまま出す。
   *
   * category は booth の絞り込みタブとタイムテーブル掲載（SCHEDULABLE_CATEGORIES）を
   * 決めているので、表示の都合で書き換えられない。ワークショップを「イベント」ではなく
   * 「ワークショップ」と見せたい、のような表示だけの要求はこちらで受ける。
   */
  categoryLabel?: string;
  name: string;
  /** 名前の読み仮名。英字やひねった表記のバンド名に添える（出演者の申告どおり） */
  reading?: string | null;
  group?: string | null;
  /** バナー等の狭い場所に出す短い要約（40字目安）。長文はdescriptionへ */
  summary?: string | null;
  description?: string | null;
  /**
   * 出演者本人からの一言（バンド募集フォームの「意気込み」）。
   * 企画を説明するdescriptionとは書き手が違うので分けて持ち、引用として見せる
   */
  comment?: string | null;
  /** 出店:飲食-フード等 / 学科展示:M科等 / イベント:day1,day2,常設,中夜祭,当日参加OK / ライブ:day1,day2,中夜祭,決勝バンド */
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
  /**
   * 期間中いつでも参加できる企画の期間（例:「10/31 オープニング後〜11/1 11:00」）。
   *
   * バザーグランプリ（投票）やわらしべ長者（物々交換）のように、参加は期間中ずっとできるが
   * 結果発表だけはステージの決まった時刻にある企画のためのもの。発表の回は occurrences に
   * `note`（「中間発表」等）付きで持ち、timetable のグリッドに載せる。
   * isPermanent と違って occurrences を持てるので、別の項目にしている。
   */
  period?: string | null;
  /**
   * 参加の仕方（例:「当日その場で参加できます（申込不要）」「出場者の募集は終了しました」）。
   * 観るだけの企画は省略する。当日参加できる企画には tags に「当日参加OK」も付ける
   */
  participation?: string | null;
  /** 代表者（バンドのリーダー等） */
  leader?: Member | null;
  /** 代表者以外の出演メンバー。leaderは含めない */
  members?: Member[];
  /** 参加型企画の対象者（例:「小学生(中学年〜高学年)と保護者」） */
  audience?: string | null;
  /** 定員。「各回10組」のような回単位の表現も許すため数値ではなく文字列 */
  capacity?: string | null;
  /** 受講料・参加費。「無料（別途 傷害保険料50円/人）」のような但し書きも含めて文字列で持つ */
  fee?: string | null;
  /** 事前申込が要る企画の申込先。申込不要ならnull */
  application?: Application | null;
  /** ※付きで並べる注意書き。descriptionの自由文に混ぜず構造化して持つ */
  notes?: string[];
  /** true: home等での特別扱い（バナー表示）対象 */
  featured?: boolean;
  /** 外部Webアプリ等へのリンク（コラージュカメラ等）。未提供の間はnull */
  link?: string | null;
  /** link のボタンの文言。省略時は「やってみる →」（バザーグランプリの「投票する →」等） */
  linkLabel?: string | null;
  /** 詳細ページの下に並べる補助リンク（アプリのダウンロード先等）。別タブで開く */
  links?: { label: string; url: string }[];
}
