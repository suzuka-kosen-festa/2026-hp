import type { Entry } from "../types/content";
import "./EntryBanner.css";

interface Props {
  entry: Entry;
}

/**
 * 常設枠のバナー（ミッションフォトラリー等）。booth と timetable で共有する。
 *
 * 記事ではなくアプリを開いてほしい企画なので、バナー全体を link へ直接のリンクにする。
 * 遊び方や景品の説明は記事にしか無いので、詳細ページへの小さなリンクを下に添える。
 * 画像は「貼り付けた紙片」として回転+ハードシャドウで見せる（design-system.md）
 */
export default function EntryBanner({ entry }: Props) {
  const pc = entry.bannerPhoto;
  if (!pc) return null;
  const sp = entry.bannerSpPhoto ?? pc;
  const detail = `/entry/${entry.id}/`;

  return (
    <div className="entry-banner">
      <a className="entry-banner-link" href={entry.link ?? detail}>
        <picture>
          {/* PCは最大760px（EntryBanner.css）、SPは画面幅いっぱい（本文幅の上限520px） */}
          <source media="(min-width: 900px)" srcSet={pc.srcset} sizes="760px" width={pc.width} height={pc.height} />
          <img
            src={sp.src}
            srcSet={sp.srcset}
            sizes="min(calc(100vw - 40px), 520px)"
            width={sp.width}
            height={sp.height}
            // 画像の中の文字（企画名）と、押すと何が開くかを読み上げる
            alt={entry.link ? `${entry.name}（${linkText(entry)}）` : entry.name}
            loading="lazy"
            decoding="async"
          />
        </picture>
      </a>
      {entry.link && (
        <a className="entry-banner-detail" href={detail}>
          遊び方・景品を見る →
        </a>
      )}
    </div>
  );
}

/** 読み上げ用のリンク先の説明。ボタン用の文言から矢印を外したもの（「アプリを開く →」→「アプリを開く」） */
function linkText(entry: Entry): string {
  return (entry.linkLabel ?? "やってみる →").replace(/\s*→$/, "");
}
