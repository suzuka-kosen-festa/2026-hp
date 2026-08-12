import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Entry } from "../../types/content";
import PromoCard from "./PromoCard";
import "./PromoCarousel.css";

interface Props {
  entries: Entry[];
  /** タップ領域を可視化する（検証用。本番では使わない） */
  showHitArea?: boolean;
}

/**
 * D: カルーセル。
 * 横スクロール自体はCSSの scroll-snap に任せる（指の慣性・キーボード・スクロールバーが
 * ネイティブのまま手に入る）。JSは現在位置の検出とドット/矢印の操作だけを担当する。
 * 両隣が少し覗く幅にしてあるので「まだある」ことは見た目で分かる。
 */
export default function PromoCarousel({ entries, showHitArea = false }: Props) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const count = entries.length;

  const scrollToIndex = useCallback(
    (i: number) => {
      const track = trackRef.current;
      const slide = track?.children[i] as HTMLElement | undefined;
      if (!track || !slide) return;
      // 中央スナップなので、スライドの中心をトラックの中心に合わせる
      const left = slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2;
      track.scrollTo({ left, behavior: shouldReduceMotion ? "auto" : "smooth" });
    },
    [shouldReduceMotion],
  );

  // スクロール位置から現在のスライドを割り出す（rAFで1フレーム1回に間引く）
  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const track = trackRef.current;
      if (!track) return;
      const center = track.scrollLeft + track.clientWidth / 2;
      let nearest = 0;
      let min = Infinity;
      Array.from(track.children).forEach((child, i) => {
        const slide = child as HTMLElement;
        const distance = Math.abs(slide.offsetLeft + slide.clientWidth / 2 - center);
        if (distance < min) {
          min = distance;
          nearest = i;
        }
      });
      setActive(nearest);
    });
  }, []);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  if (count === 0) return null;
  // 1件のときはスクロールも操作UIも要らないので、ただの1枚として見せる
  const isSingle = count === 1;

  if (isSingle) {
    return (
      <div className={`pcar pcar--single ${showHitArea ? "pcar--hit" : ""}`}>
        <PromoCard entry={entries[0]} interactive />
      </div>
    );
  }

  return (
    <div className={`pcar ${showHitArea ? "pcar--hit" : ""}`}>
      <div
        ref={trackRef}
        className="pcar__track"
        onScroll={handleScroll}
        role="group"
        aria-roledescription="カルーセル"
        aria-label="注目の企画"
        tabIndex={0}
        onKeyDown={(e) => {
          // 素のスクロールだと矢印キーで数十pxずつ動いてスナップと喧嘩するので、1枚単位に揃える
          if (e.key === "ArrowRight") {
            e.preventDefault();
            scrollToIndex(Math.min(active + 1, count - 1));
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            scrollToIndex(Math.max(active - 1, 0));
          }
        }}
      >
        {entries.map((entry, i) => (
          <div
            key={entry.id}
            className="pcar__slide"
            role="group"
            aria-roledescription="スライド"
            aria-label={`${i + 1} / ${count}`}
          >
            <PromoCard entry={entry} interactive />
          </div>
        ))}
      </div>

      <div className="pcar__nav">
        <button
          type="button"
          className="pcar__arrow"
          onClick={() => scrollToIndex(active - 1)}
          disabled={active === 0}
          aria-label="前の企画へ"
        >
          ←
        </button>

        <div className="pcar__dots" role="group" aria-label="企画を選ぶ">
          {entries.map((entry, i) => (
            <button
              key={entry.id}
              type="button"
              className={`pcar__dot ${i === active ? "is-active" : ""}`}
              aria-current={i === active}
              aria-label={`${i + 1}枚目: ${entry.name}`}
              onClick={() => scrollToIndex(i)}
            >
              <span className="pcar__dot-mark" aria-hidden="true" />
              {/* 現在位置のテープだけがドット間を滑って移動する（Framer Motionを使う価値がある箇所） */}
              {i === active && (
                <motion.span
                  layoutId="pcar-marker"
                  className="pcar__marker"
                  aria-hidden="true"
                  transition={
                    shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }
                  }
                />
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="pcar__arrow"
          onClick={() => scrollToIndex(active + 1)}
          disabled={active === count - 1}
          aria-label="次の企画へ"
        >
          →
        </button>
      </div>

      <p className="pcar__status" aria-live="polite">
        {active + 1} / {count} {entries[active].name}
      </p>
    </div>
  );
}
