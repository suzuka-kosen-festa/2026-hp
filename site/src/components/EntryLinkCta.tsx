import { useEffect, useState } from "react";
import { isLinkOpen } from "../lib/entryLink";
import type { Entry } from "../types/content";

interface Props {
  entry: Entry;
  /** 置く場所ごとの見た目（booth は bl-permanent-cta / timetable は tl-permanent-cta） */
  className: string;
}

/**
 * 常設カードの外部リンクCTA（バザーグランプリの「投票する →」等）。booth と timetable で共有する。
 *
 * 公開日（linkOpens）を持つ導線は、SSRでは出さず、マウント後に閲覧時の時刻で出し直す。
 * ビルド時刻で決めると、当日に再デプロイしない限りボタンが開かない。
 * 公開日の無い導線は今までどおりSSRから出す（こちらまで後出しにすると、JSが動くまで
 * ボタンが消えて見えるうえ、ハイドレーション不一致でコンソールエラーになる）
 */
export default function EntryLinkCta({ entry, className }: Props) {
  // SSRと最初のクライアント描画で同じ null にする。ここでいきなり Date.now() を読むと
  // 公開日をまたいだ瞬間にSSRのHTMLと食い違う（_shared.ts の検査で落ちる）
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, []);

  if (!entry.link) return null;
  if (entry.linkOpens && !(now !== null && isLinkOpen(entry.linkOpens, now))) return null;

  return (
    <a className={className} href={entry.link}>
      {entry.linkLabel ?? "やってみる →"}
    </a>
  );
}
