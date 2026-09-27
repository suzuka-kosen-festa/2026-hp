import { useEffect, useRef } from "react";
import themeLogoUrl from "../../assets/logo/theme-logo.png";
import "./OpCandidate2.css";

const CLIPS = [
  "polygon(0 0,57% 0,48% 26%,0 39%)",
  "polygon(57% 0,100% 0,100% 42%,48% 26%)",
  "polygon(0 39%,48% 26%,100% 42%,65% 60%,0 57%)",
  "polygon(0 57%,65% 60%,49% 81%,0 100%)",
  "polygon(65% 60%,100% 42%,100% 100%,49% 100%,49% 81%)",
  "polygon(0 100%,49% 81%,49% 100%)",
];

export default function OpCandidate2({ day }: { day: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    const size = Math.min(bounds.height * .83, bounds.width * .84 / (day.length * .87));
    stage.style.setProperty("--op2-digit-size", `${size}px`);
    const animations: Animation[] = [];
    const animate = (element: Element | null, frames: Keyframe[], delay: number, duration: number, easing = "cubic-bezier(.2,.75,.23,1)") => {
      if (element) animations.push(element.animate(frames, { delay, duration, fill: "both", easing }));
    };
    stage.querySelectorAll(".op2-fragment").forEach((fragment, index) => {
      const piece = index % 6, digit = Math.floor(index / 6);
      const angle = (piece * 137 + digit * 73) * Math.PI / 180;
      const x = Math.cos(angle) * bounds.width * .7, y = Math.sin(angle) * bounds.height * .75;
      const rotation = (piece % 2 ? 1 : -1) * (35 + piece * 11);
      animate(fragment, [
        { transform: `translate(${x}px,${y}px) rotate(${rotation}deg) scale(1.5)` },
        { transform: `translate(${x * .3}px,${y * .3}px) rotate(${rotation * .4}deg) scale(1.12)`, offset: .43 },
        { transform: "translate(-2px,3px) rotate(-.5deg) scale(.997)", offset: .87 },
        { transform: "none" },
      ], 850 + piece * 80 + digit * 90, 800);
    });
    stage.querySelectorAll(".opening-paper").forEach((paper, index) => animate(paper, [
      { transform: `translateY(${index ? 115 : 0}%) rotate(${index % 2 ? 8 : -7}deg)` },
      { transform: `translateY(0) rotate(${index % 2 ? 3 : -3}deg)`, offset: .23 },
      { transform: `translateY(0) rotate(${index % 2 ? 1 : -1}deg)`, offset: .56 },
      { transform: `translateY(-125%) rotate(${index % 2 ? -12 : 12}deg)` },
    ], index * 300, 800, "linear"));
    [".op2-red", ".op2-stripe", ".op2-yellow", ".op2-blue"].forEach((selector, index) => {
      const rotation = [-7, 13, -14, 16][index];
      animate(stage.querySelector(selector), [
        { transform: `translate(${index % 2 ? 100 : -100}%,${index < 2 ? -60 : 70}%) rotate(${rotation * 3}deg)` },
        { transform: `rotate(${rotation}deg)` },
      ], 900 + index * 100, 1100);
    });
    [".op2-eyebrow", ".op2-date", ".op2-edition"].forEach((selector, index) => animate(stage.querySelector(selector), [
      { opacity: 0, transform: "translateY(15px)" }, { opacity: 1, transform: "none" },
    ], 1900 + index * 80, 280));
    animate(stage.querySelector(".op2-poster"), [{ transform: "scale(1.12)" }, { transform: "scale(1)" }], 800, 1500);
    animate(stage.querySelector(".op2-wipe"), [
      { transform: "translateY(110%) rotate(-7deg)" },
      { transform: "translateY(0) rotate(0)", offset: .5 },
      { transform: "translateY(-115%) rotate(5deg)" },
    ], 2850, 650, "linear");
    animate(stage.querySelector(".op2-hero"), [{ opacity: 0 }, { opacity: 1 }], 3175, 1);
    animate(stage.querySelector(".op2-hero img"), [
      { transform: "translateY(30px) scale(.96)" }, { transform: "none" },
    ], 3175, 500);
    animate(stage.querySelector(".op2-hero span"), [{ opacity: 0 }, { opacity: 1 }], 3350, 350);
    return () => animations.forEach(animation => animation.cancel());
  }, [day]);

  return <div className="op-candidate2" ref={stageRef} aria-label={`開催まであと${day}日`}>
    <div className="op2-poster">
      <div className="op2-grain" />
      <div className="op2-edge op2-red" /><div className="op2-edge op2-stripe" />
      <div className="op2-edge op2-yellow" /><div className="op2-edge op2-blue" />
      <div className="op2-eyebrow">開催まであと</div>
      <div className="op2-digits">{[...day].map((digit, digitIndex) =>
        <div className="op2-digit" key={digitIndex}>{CLIPS.map((clipPath, piece) =>
          <div className="op2-fragment" key={piece} style={{
            clipPath, backgroundPosition: `${Number(digit) % 5 * 25}% ${Number(digit) > 4 ? 100 : 0}%`,
          }} />)}</div>)}</div>
      <div className="op2-date">2026年10月31日（土）・11月1日（日）</div>
      <div className="op2-edition">第61回鈴鹿高専祭</div>
    </div>
    <div className="op2-opening" aria-hidden="true">
      <div className="opening-paper op2-first"><svg viewBox="0 0 600 240" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter"><g transform="rotate(-9 180 120)"><rect x="55" y="78" width="250" height="84"/><path d="M78 79v35m24-35v20m24-20v20m24-20v35m24-35v20m24-20v20m24-20v35m24-35v20m24-20v20m24-20v35"/><path d="M78 139h204" strokeWidth="3"/></g><g transform="rotate(18 445 120)"><path d="M421 30h48v137l-24 45-24-45z"/><path d="M421 55h48m-48 112h48m-24 0v37" strokeWidth="4"/><path d="M431 30V17h28v13"/></g></g></svg></div>
      <div className="opening-paper op2-second"><svg viewBox="0 0 600 240" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="5" strokeLinejoin="miter"><path d="M48 38h275v164H48zM48 68h275"/><circle cx="69" cy="53" r="4" fill="currentColor"/><circle cx="84" cy="53" r="4" fill="currentColor"/><path d="M356 120h46m0-45v90m0-66 58-45h75m-133 87 58 45h75"/><circle cx="461" cy="120" r="76"/></g><g fill="currentColor" fontFamily="Consolas,monospace" fontSize="28" fontWeight="700"><text x="70" y="109">{"if (day > 0) {"}</text><text x="94" y="146">day--;</text><text x="70" y="181">{"}"}</text></g></svg></div>
      <div className="opening-paper op2-third"><svg viewBox="0 0 600 240" fill="none" aria-hidden="true">
        <text x="55" y="149" fill="currentColor" fontFamily="Arial,sans-serif" fontSize="98" fontWeight="800" letterSpacing="-8">NaCl</text>
        <g stroke="currentColor" strokeWidth="5" strokeLinejoin="miter">
          <path d="M346 72h154v100H346zM346 72l30-30h154l-30 30m0 0 30-30v100l-30 30"/>
          <path d="M423 72v100m-77-50h154" strokeWidth="3"/>
          {[346, 423, 500].flatMap(x => [72, 172].map(y => <circle key={`${x}-${y}`} cx={x} cy={y} r="22" fill="#1723a3"/>))}
        </g>
        <g fill="currentColor" fontFamily="Arial,sans-serif" fontSize="14" fontWeight="700" textAnchor="middle">
          <text x="346" y="77">Na+</text><text x="423" y="77">Cl−</text><text x="500" y="77">Na+</text>
          <text x="346" y="177">Cl−</text><text x="423" y="177">Na+</text><text x="500" y="177">Cl−</text>
        </g>
      </svg></div>
    </div>
    <div className="op2-wipe" />
    <div className="op2-hero"><img src={themeLogoUrl.src} alt="collage 2026" /><span>2026年10月31日（土）・11月1日（日）</span></div>
  </div>;
}
