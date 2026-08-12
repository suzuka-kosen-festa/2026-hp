import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Entry } from "../../types/content";
import PromoCard from "./PromoCard";
import "./PromoStack.css";

/** 操作方法の比較用。edge=覗いている端を直接タップ / tabs=テープタブで選ぶ */
export type PromoControl = "edge" | "tabs";

interface Props {
  entries: Entry[];
  control?: PromoControl;
  /** タップ領域を可視化する（検証用。本番では使わない） */
  showHitArea?: boolean;
}

/** 背面カードのずらし量。x が「覗いている端の幅」＝ edge モードでの実質タップ幅になる */
const LAYERS = [
  { x: 0, y: 0, rotate: -1, scale: 1 },
  { x: 16, y: 12, rotate: 2.2, scale: 0.975 },
  { x: 30, y: 23, rotate: -3.4, scale: 0.95 },
];

export default function PromoStack({ entries, control = "tabs", showHitArea = false }: Props) {
  const [active, setActive] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const count = entries.length;

  if (count === 0) return null;
  // 1件のときは重なりも切り替えUIも出さず、ただの1枚として見せる
  const isSingle = count === 1;

  return (
    <div className={`ps ${showHitArea ? "ps--hit" : ""}`}>
      <div className="ps__stack" style={{ paddingRight: isSingle ? 0 : LAYERS[1].x + 14 }}>
        {entries.map((entry, i) => {
          const pos = (i - active + count) % count;
          const layer = LAYERS[Math.min(pos, LAYERS.length - 1)];
          const isFront = pos === 0;
          const behind = !isFront;

          return (
            <motion.div
              key={entry.id}
              className={`ps__card ${isFront ? "is-front" : "is-behind"}`}
              style={{ zIndex: count - pos }}
              animate={{ x: layer.x, y: layer.y, rotate: layer.rotate, scale: layer.scale }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 26, mass: 0.8 }
              }
              // edgeモードでは背面カードそのものがボタン。覗いている端しか押せない
              onClick={control === "edge" && behind ? () => setActive(i) : undefined}
              role={control === "edge" && behind ? "button" : undefined}
              tabIndex={control === "edge" && behind ? 0 : undefined}
              aria-label={control === "edge" && behind ? `${entry.name} を前面に出す` : undefined}
              aria-hidden={behind && control !== "edge"}
            >
              <PromoCard entry={entry} interactive={isFront} />
            </motion.div>
          );
        })}
      </div>

      {!isSingle && control === "tabs" && (
        <div className="ps__tabs" role="tablist" aria-label="お知らせの切り替え">
          {entries.map((entry, i) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={`ps__tab ${i === active ? "is-active" : ""}`}
              onClick={() => setActive(i)}
            >
              <span className="ps__tab-index num">{String(i + 1).padStart(2, "0")}</span>
              <span className="ps__tab-name">{entry.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
