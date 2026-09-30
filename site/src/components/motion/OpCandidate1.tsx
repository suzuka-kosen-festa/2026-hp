import { useEffect, useRef } from "react";
import themeLogoUrl from "../../assets/logo/theme-logo.png";
import "./OpCandidate1.css";

export default function OpCandidate1({ day }: { day: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const animations: Animation[] = [];
    const animate = (element: Element, frames: Keyframe[], delay: number, duration: number) => {
      animations.push(element.animate(frames.map(frame => ({ ...frame, easing: "cubic-bezier(.22,.7,.18,1)" })), { delay, duration, fill: "both", easing: "linear" }));
    };
    stage.querySelectorAll(".digit-piece").forEach((piece, index) => {
      const row = index % 4;
      animate(piece, [
        { opacity: 0, transform: `translate(${row % 2 ? 45 : -45}px,${row % 2 ? -24 : 24}px) rotate(${row % 2 ? 7 : -7}deg)` },
        { opacity: 1, transform: "none", offset: .25 },
        { opacity: 1, transform: "none", offset: .65 },
        { opacity: 0, transform: `translate(${(row - 1.5) * 85}px,${row % 2 ? -35 : 35}px) rotate(${row % 2 ? -9 : 9}deg)` },
      ], Math.floor(index / 4) * 65 + row * 42, 2450);
    });
    stage.querySelectorAll(".logo-piece").forEach((piece, index) => {
      animate(piece, [
        { opacity: 0, transform: `translate(${(index - 3) * 15}px,${index % 2 ? 32 : -32}px) rotate(${index % 2 ? 3 : -3}deg)` },
        { opacity: 1, transform: "none" },
      ], 1930 + index * 54, 850);
    });
    stage.querySelectorAll(".op1-chrome").forEach(element => animate(element, [
      { opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" },
    ], 2600, 650));
    return () => animations.forEach(animation => animation.cancel());
  }, [day]);

  return <div className="op-candidate1" ref={stageRef} aria-label={`開催まであと${day}日`}>
    <div className="op1-chrome op1-top"><span>61st SUZUKA KOSEN FESTIVAL</span><span>2026</span></div>
    <div className="op1-composition">
      <div className="op1-logo" aria-label="collage 2026">{Array.from({ length: 7 }, (_, index) =>
        <div className="logo-piece" key={index} style={{
          clipPath: `polygon(${index * 100 / 7}% 0,${(index + 1) * 100 / 7 + .1}% 0,${(index + 1) * 100 / 7 + .1}% 100%,${index * 100 / 7}% 100%)`,
          backgroundImage: `url("${themeLogoUrl.src}")`,
        }} />)}</div>
      <div className="op1-digits" aria-hidden="true">{[...day].map((digit, digitIndex) =>
        <div className="op1-digit" key={digitIndex}>{Array.from({ length: 4 }, (_, row) =>
          <div className="digit-piece" key={row} style={{
            backgroundPosition: `${Number(digit) % 5 * 25}% ${Number(digit) > 4 ? 100 : 0}%`,
            clipPath: `polygon(0 ${row * 25}%,100% ${row * 25}%,100% ${(row + 1) * 25}%,0 ${(row + 1) * 25}%)`,
          }} />)}</div>)}</div>
    </div>
    <div className="op1-chrome op1-bottom"><span>10.31 SAT — 11.01 SUN</span><span>SUZUKA KOSEN</span></div>
  </div>;
}
