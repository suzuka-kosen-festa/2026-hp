import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Entry } from "../../types/content";
import PromoCard from "./PromoCard";
import "./PromoWallet.css";

interface Props {
  entries: Entry[];
  /** タップ領域を可視化する（検証用。本番では使わない） */
  showHitArea?: boolean;
}

/**
 * 畳んだ状態の重なり。PromoStack と同じずらし量にしてあるが、
 * ここでは覗いている端は「まだある」を伝えるだけの飾りで、タップ対象にはしない。
 */
const LAYERS = [
  { x: 0, y: 0, rotate: -1, scale: 1 },
  { x: 16, y: 12, rotate: 2.2, scale: 0.975 },
  { x: 30, y: 23, rotate: -3.4, scale: 0.95 },
];

/**
 * C: Apple Wallet 型。
 * 畳んだ状態ではスタック全体が1つの大きなボタンで、どこを押しても一覧が開く。
 * 一覧のカードを押すとそれが前面に来て畳まれる。
 * ねらい: 覗いている端の細さ（約16px）を操作の精度に持ち込まないこと。
 */
export default function PromoWallet({ entries, showHitArea = false }: Props) {
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const openerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // 初回描画では勝手にフォーカスを奪わない
  const mounted = useRef(false);

  // 開いたら一覧の現在項目へ、閉じたらスタックへフォーカスを戻す（キーボード操作の迷子防止）
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (expanded) itemRefs.current[active]?.focus();
    else openerRef.current?.focus();
  }, [expanded]);

  const count = entries.length;
  if (count === 0) return null;
  // 1件のときは重なりも展開UIも出さず、ただの1枚として見せる
  const isSingle = count === 1;
  const activeEntry = entries[active];

  const spring = shouldReduceMotion
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 260, damping: 26, mass: 0.8 } as const);
  const fade = shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

  const select = (i: number) => {
    setActive(i);
    setExpanded(false);
  };

  return (
    <div
      className={`pw ${showHitArea ? "pw--hit" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Escape" && expanded) {
          e.stopPropagation();
          setExpanded(false);
        }
      }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {!expanded ? (
          <motion.div
            key="collapsed"
            className="pw__stack"
            style={{ paddingRight: isSingle ? 0 : LAYERS[1].x + 14 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
          >
            {entries.map((entry, i) => {
              const pos = (i - active + count) % count;
              const layer = LAYERS[Math.min(pos, LAYERS.length - 1)];
              return (
                <motion.div
                  key={entry.id}
                  className="pw__card"
                  style={{ zIndex: count - pos }}
                  animate={{ x: layer.x, y: layer.y, rotate: layer.rotate, scale: layer.scale }}
                  transition={spring}
                  aria-hidden={pos !== 0}
                >
                  <PromoCard entry={entry} />
                </motion.div>
              );
            })}

            {/* スタック全体を覆う1枚のボタン。カードの上に重ねることで、
                「押せる範囲＝カード全面」になる（端の細さが操作精度に効かない） */}
            {!isSingle && (
              <button
                ref={openerRef}
                type="button"
                className="pw__opener"
                aria-expanded={false}
                onClick={() => setExpanded(true)}
                aria-label={`${activeEntry.name} ほか全${count}件。押すと一覧を開く`}
              >
                <span className="pw__more num" aria-hidden="true">
                  +{count - 1} MORE
                </span>
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            className="pw__panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
          >
            <ul className="pw__list">
              {entries.map((entry, i) => (
                <motion.li
                  key={entry.id}
                  className="pw__item"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: -14, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 320, damping: 28, delay: i * 0.05 }
                  }
                >
                  <PromoCard entry={entry} compact />
                  {/* カード全面をボタンにする。中身に見出しやリンクを入れると
                      button の入れ子として不正になるので、透明ボタンを重ねる形にしている */}
                  <button
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    type="button"
                    className="pw__item-btn"
                    aria-current={i === active}
                    onClick={() => select(i)}
                    aria-label={i === active ? `${entry.name}（表示中）に戻る` : `${entry.name} を前面に出す`}
                  />
                </motion.li>
              ))}
            </ul>
            <button type="button" className="pw__close" onClick={() => setExpanded(false)}>
              閉じる
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTAはスタックの外に出す。カード全面がボタンなので、中にリンクを置くと押し分けられない */}
      {!expanded && activeEntry.link && (
        <a className="pw__cta pc__cta" href={activeEntry.link}>
          やってみる
        </a>
      )}
    </div>
  );
}
