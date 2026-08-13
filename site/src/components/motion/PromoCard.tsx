import type { Entry } from "../../types/content";
import "./PromoCard.css";

interface Props {
  entry: Entry;
  /** CTAリンクを出すか。CTAをカードの外に置く方式では false */
  interactive?: boolean;
  /** 一覧に並べる用の横組み・小型版 */
  compact?: boolean;
  /** compact時、詳細ページへの誘導文を出す。行全体がリンクになっている前提の飾り */
  more?: boolean;
}

/**
 * 広告カードの見た目本体。並べ方（PromoList / PromoStack / PromoCarousel）に依らず
 * 見た目を1箇所に集約する。方式ごとに作り直すと見た目が揃わない。
 */
export default function PromoCard({ entry, interactive = false, compact = false, more = false }: Props) {
  // 常設かどうかは isPermanent が正。タグは絞り込み用の文字列で、
  // 付け忘れても型では防げないため、ラベルの判定には使わない。
  // 常設でなければカテゴリをそのまま出す（"イベント"固定だと出店の広告で嘘になる）
  const label = entry.isPermanent ? "常設企画" : entry.category;

  const photo = (
    <div className="pc__photo">
      {entry.image ? (
        <img src={entry.image} alt="" loading="lazy" />
      ) : (
        <span className="pc__noimg num">NO IMAGE</span>
      )}
    </div>
  );

  if (compact) {
    // 一覧に積むので写真は小さく、本文は summary の1行だけ。詳しくは詳細ページに送る
    return (
      <div className="pc pc--compact">
        {photo}
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

  return (
    <div className="pc">
      {photo}
      <div className="pc__body">
        <p className="pc__label">{label}</p>
        <h3 className="pc__name">{entry.name}</h3>
        {entry.location && <p className="pc__place">{entry.location}</p>}
        {entry.description && <p className="pc__desc">{entry.description}</p>}
        {entry.link && interactive && (
          <a className="pc__cta" href={entry.link}>
            やってみる
          </a>
        )}
      </div>
    </div>
  );
}
