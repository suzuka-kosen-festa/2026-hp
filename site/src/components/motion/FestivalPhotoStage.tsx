import { useEffect, useRef, type CSSProperties } from "react";
import themeLogoUrl from "../../assets/logo/theme-logo.png";
import { createFestivalTiles, FESTIVAL_ATLAS } from "./festivalOp";
import "./FestivalPhotoStage.css";

export default function FestivalPhotoStage({ tiles }: { tiles: ReturnType<typeof createFestivalTiles> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    // 明示的な再生時も、低減設定では最終ロゴを静止表示する。
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animations: Animation[] = [];
    const animate = (element: Element | null, frames: Keyframe[], delay: number, duration: number, easing = "cubic-bezier(.22,.7,.18,1)") => {
      if (element) animations.push(element.animate(frames, { delay, duration, fill: "both", easing }));
    };
    const { width, height } = stage.getBoundingClientRect();
    const flightX = Math.max(240, width * .7), flightY = Math.max(360, height * .65);
    stage.querySelectorAll<HTMLElement>(".festival-photo-tile").forEach((tile, index) => {
      const { order, tilt, fallOrder } = tiles[index];
      const sign = tilt < 0 ? -1 : 1;
      const start = order * 22, slip = 2100 + fallOrder * 12, end = slip + 900;
      const duration = end - start;
      const pose = (x: number, y: number, angle: number, scale = "1") => `translate(-50%,-50%) translate(${x}px,${y}px) rotate(${angle}deg) scale(${scale})`;
      // 着地と落下を同じ時間軸に置き、transformの競合を防ぐ。
      const frame = (time: number, transform: string, opacity = 1, easing = "linear"): Keyframe => ({ offset: (time - start) / duration, transform, opacity, easing });
      animate(tile, [
        frame(start, pose(sign * flightX, -flightY, tilt + sign * 36, "3.2"), 0),
        frame(start + 30, pose(sign * flightX * .86, -flightY * .86, tilt + sign * 30, "2.8"), 1, "cubic-bezier(.55,0,.95,.55)"),
        frame(start + 240, pose(0, 3, tilt - sign * 4, "1.07,.91"), 1, "cubic-bezier(.1,.8,.2,1)"),
        frame(start + 350, pose(0, 0, tilt)),
        frame(slip, pose(0, 0, tilt), 1, "ease-in"),
        frame(slip + 120, pose(sign * 4, 14, tilt + sign * 8), 1, "ease-in-out"),
        frame(slip + 240, pose(sign * 9, 32, tilt + sign * 16), 1, "ease-in-out"),
        frame(slip + 330, pose(sign * 7, 27, tilt + sign * 11), 1, "cubic-bezier(.65,0,1,.5)"),
        frame(end, pose(sign * 100, height * 1.7, tilt + sign * 42)),
      ], start, duration, "linear");
    });
    animate(stage.querySelector(".festival-photo-artwork"), [
      { opacity: 0, transform: "scale(.94) rotate(-2deg)" },
      { opacity: 1, transform: "scale(1.025) rotate(.6deg)", offset: .65 },
      { opacity: 1, transform: "none" },
    ], 1900, 420);
    return () => animations.forEach(animation => animation.cancel());
  }, [tiles]);
  return <div ref={ref} className="festival-photo-stage" aria-label="実行委員の写真を貼り、ずり落ちるとcollageロゴが現れるオープニング" style={{ "--festival-atlas": `url("${FESTIVAL_ATLAS.src}")` } as CSSProperties}>
    <div className="festival-photo-camera">
      <img className="festival-photo-artwork" src={themeLogoUrl.src} alt="collage 2026" />
    </div>
    <div className="festival-photo-pile" aria-hidden="true">
      {tiles.map(({ number, atlasIndex, left, top, order, tilt }, index) => <div key={index} className="festival-photo-tile" data-photo-number={number} style={{
        left: `${left}%`, top: `${top}%`, zIndex: order, "--photo-angle": `${tilt}deg`,
      } as CSSProperties}><div className="festival-photo-face" style={{ backgroundPosition: `${atlasIndex % 11 * 10}% ${Math.floor(atlasIndex / 11) * 25}%` }} /></div>)}
    </div>
  </div>;
}
