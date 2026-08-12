import type { Entry } from "../../types/content";
import "./PromoCard.css";

interface Props {
  entry: Entry;
  /** CTAリンクを出すか。背面カードや、CTAをカードの外に置く方式では false */
  interactive?: boolean;
  /** 一覧に並べる用の横組み・小型版 */
  compact?: boolean;
  /** compact時、詳細ページへの誘導文を出す。行全体がリンクになっている前提の飾り */
  more?: boolean;
}

/**
 * 広告カードの見た目本体。切り替え方式（PromoStack / PromoWallet / PromoCarousel）で
 * 共通して使う。方式ごとに作り直すと見た目が揃わず比較にならないため1箇所にまとめている。
 */
export default function PromoCard({ entry, interactive = false, compact = false, more = false }: Props) {
  const label = entry.tags.includes("常設") ? "常設企画" : "イベント";

  if (compact) {
    // 一覧に積むので写真は小さく、本文は落として「どれを選ぶか」に必要な情報だけ残す
    return (
      <div className="pc pc--compact">
        <div className="pc__photo">
          {entry.image ? <img src={entry.image} alt="" loading="lazy" /> : <span className="pc__noimg num">NO IMAGE</span>}
        </div>
        <div className="pc__body">
          <p className="pc__label">{label}</p>
          <p className="pc__name">{entry.name}</p>
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
      <div className="pc__photo">
        {entry.image ? <img src={entry.image} alt="" loading="lazy" /> : <span className="pc__noimg num">NO IMAGE</span>}
      </div>
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
