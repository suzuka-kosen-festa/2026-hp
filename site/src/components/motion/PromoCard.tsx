import type { Entry } from "../../types/content";
import "./PromoCard.css";

interface Props {
  entry: Entry;
  /** 詳細ページへの誘導文を出す。行全体がリンクになっている前提の飾り */
  more?: boolean;
}

/**
 * 広告カードの見た目本体。並べ方（現状は PromoList のみ）から見た目を切り離し、
 * 並べ方を足してもカードを作り直さずに済むようにしている。
 *
 * 説明は summary の1行だけに留め、長文の description・開催回・対象・定員は
 * 詳細ページ /entry/[id] 側で構造化して出す（requirements.md §3.3）。
 */
export default function PromoCard({ entry, more = false }: Props) {
  // 常設かどうかは isPermanent が正。タグは絞り込み用の文字列で、
  // 付け忘れても型では防げないため、ラベルの判定には使わない。
  // 常設でなければカテゴリをそのまま出す（"イベント"固定だと出店の広告で嘘になる）
  const label = entry.isPermanent ? "常設企画" : entry.category;

  return (
    <div className="pc pc--compact">
      <div className="pc__photo">
        {entry.image ? (
          <img src={entry.image} alt="" loading="lazy" />
        ) : (
          <span className="pc__noimg num">NO IMAGE</span>
        )}
      </div>
      <div className="pc__body">
        <p className="pc__label">{label}</p>
        <p className="pc__name">{entry.name}</p>
        {entry.summary && <p className="pc__summary">{entry.summary}</p>}
        {entry.location && <p className="pc__place">{entry.location}</p>}
        {/* 行全体がリンクなので、これ自体は押せる要素ではなく誘導の合図 */}
        {more && (
          <span className="pc__more num" aria-hidden="true">
            view more →
          </span>
        )}
      </div>
    </div>
  );
}
