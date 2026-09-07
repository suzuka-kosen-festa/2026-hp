import type { Entry } from "../types/content";

/** チップの色。Chip.astro / .bl-chip が持っているのはこの2色 */
export type TagColor = "red" | "blue";

/**
 * タグの表示名と色。**これが唯一の対応表**。
 *
 * 絞り込みバー（BoothList の TABS）とカードのチップ、詳細ページのチップが
 * すべてここを引く。表示名を片方だけに置くと、同じ画面でフィルタは「機械」、
 * カードは「M科」と違う言葉が出る（Issue #53）。
 *
 * 色はタグごとに決める。**配列の並び順で決めない**こと。以前はカード側が
 * index の偶奇（ti % 2）で赤青を振っていたため、データを並べ替えただけで
 * 色が変わり、同じタグがカードごとに違う色になっていた。
 *
 * 色の使い分け:
 *   赤 … 飲食と、ライブの特別枠（中夜祭・決勝バンド）。目を引かせたいもの
 *   青 … それ以外（学科展示・物販・展示・レク・常設）
 */
export const TAG_META: Record<string, { label: string; color: TagColor }> = {
  // 出店
  "飲食-フード": { label: "飲食-フード", color: "red" },
  "飲食-スイーツ": { label: "飲食-スイーツ", color: "red" },
  レク: { label: "レク", color: "blue" },
  物販: { label: "物販", color: "blue" },
  展示: { label: "展示", color: "blue" },

  // 学科展示。簡略表記はカードの横幅の都合による意図的なもので、
  // 正式名称（電子情報工学科など）は各エントリの group が持っている
  M科: { label: "機械", color: "blue" },
  E科: { label: "電気電子", color: "blue" },
  I科: { label: "電子情報", color: "blue" },
  C科: { label: "生物応用", color: "blue" },
  S科: { label: "材料", color: "blue" },

  // イベント・ライブ
  常設: { label: "常設", color: "blue" },
  中夜祭: { label: "中夜祭", color: "red" },
  決勝バンド: { label: "決勝バンド", color: "red" },
};

/**
 * 日付タグ。
 *
 * 絞り込みには使うが、**カードや詳細ページのチップには出さない**。すぐ下に
 * 「10/31 SAT 11:00-12:00」という時刻行が出るので、日付だけのチップは重複する。
 */
const DAY_TAGS = ["day1", "day2"];

export function isDayTag(tag: string) {
  return DAY_TAGS.includes(tag);
}

/** タグの表示名。対応表に無いタグは、書き間違いに気づけるようそのまま出す */
export function tagLabel(tag: string) {
  return TAG_META[tag]?.label ?? tag;
}

/** タグの色。対応表に無いタグは青に寄せる（赤は目を引かせたいものに取っておく） */
export function tagColor(tag: string): TagColor {
  return TAG_META[tag]?.color ?? "blue";
}

/** チップとして出すタグ。日付タグは落とす */
export function displayTags(tags: string[]) {
  return tags.filter((tag) => !isDayTag(tag));
}

/**
 * このエントリが絞り込みタグに一致するか。
 *
 * 日付だけは `tags` ではなく `occurrences`（開催の実体）で判定する。
 * タグは表示用の絞り込み語なので、開催日という事実の情報源にはしない
 * （`isPermanent` を tags から独立させたのと同じ理由）。これにより、
 * データ側で day タグを書き忘れても絞り込みから漏れなくなる。
 */
export function matchesTag(entry: Entry, tag: string) {
  if (isDayTag(tag)) return entry.occurrences.some((occurrence) => occurrence.day === tag);

  return entry.tags.includes(tag);
}
