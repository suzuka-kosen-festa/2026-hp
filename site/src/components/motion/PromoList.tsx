import { motion, useReducedMotion } from "motion/react";
import type { Entry } from "../../types/content";
import PromoCard from "./PromoCard";
import "./PromoList.css";

interface Props {
  entries: Entry[];
  /** 各行のリンク先。既定は汎用詳細ルート */
  hrefFor?: (entry: Entry) => string;
  /** タップ領域を可視化する（検証用。本番では使わない） */
  showHitArea?: boolean;
}

const defaultHref = (entry: Entry) => `/entry/${entry.id}/`;

/** 貼り重ねた紙に見えるよう、行ごとに角度を散らす（全部同じ角度だと機械的に見える） */
const TILTS = [-0.7, 0.8, -0.5, 1];

/**
 * 広告を全件そのまま縦に並べる一覧。
 *
 * Wallet型（畳んで→展開）を検討したが、広告は多くても4件程度と分かったため
 * 畳む必要がなくなった。畳まないことで「2手かかる」「展開すると畳んだ状態より
 * 情報が減る」という Wallet型の弱点が両方消える。
 *
 * 行全体が詳細ページへのリンク。カード内にCTAリンクを別途置かないので、
 * リンクの入れ子にならず、タップ領域も行の全面になる。
 *
 * home 専用ではなくエントリの配列を受け取るだけなので、他ページの広告枠にも使える。
 */
export default function PromoList({ entries, hrefFor = defaultHref, showHitArea = false }: Props) {
  const shouldReduceMotion = useReducedMotion();
  if (entries.length === 0) return null;

  return (
    <ul className={`pl ${showHitArea ? "pl--hit" : ""}`}>
      {entries.map((entry, i) => {
        const tilt = TILTS[i % TILTS.length];
        return (
          <motion.li
            key={entry.id}
            className="pl__item"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -14, scale: 0.96, rotate: tilt * 3 }}
            whileInView={{ opacity: 1, y: 0, scale: 1, rotate: tilt }}
            viewport={{ once: true, margin: "-40px" }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 320, damping: 28, delay: i * 0.06 }
            }
          >
            <a className="pl__link" href={hrefFor(entry)} aria-label={`${entry.name} の詳細を見る`}>
              <PromoCard entry={entry} more />
            </a>
          </motion.li>
        );
      })}
    </ul>
  );
}
