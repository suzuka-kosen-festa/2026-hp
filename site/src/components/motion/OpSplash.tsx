import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import themeLogoUrl from "../../assets/logo/theme-logo.png";
import "./OpSplash.css";

const SESSION_KEY = "op-seen";
export const OP_REPLAY_EVENT = "op:replay";
const DURATION = 5500;

type NetworkInformation = { saveData?: boolean; effectiveType?: string };
function isSlowNetwork() {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return !!(connection?.saveData || (connection?.effectiveType && ["slow-2g", "2g"].includes(connection.effectiveType)));
}

function daysToFestival() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  const days = Math.ceil((Date.UTC(2026, 9, 31) - Date.UTC(+parts.year, +parts.month - 1, +parts.day)) / 86_400_000);
  return String(Math.max(1, Math.min(999, days)));
}

function makeClips() {
  const points = Array.from({ length: 7 }, (_, row) => Array.from({ length: 5 }, (_, column) => [
    column * 25 + (column === 0 || column === 4 ? 0 : Math.sin(row * 2 + column * 3) * 4),
    row * 100 / 6 + (row === 0 || row === 6 ? 0 : Math.sin(column * 2 + row) * 3),
  ]));
  const clips: string[] = [];
  for (let row = 0; row < 6; row++) for (let part = 0; part < 4; part++) {
    const column = row % 2 ? 3 - part : part;
    const vertices = [points[row][column], points[row][column + 1], points[row + 1][column + 1], points[row + 1][column]];
    const cx = vertices.reduce((sum, point) => sum + point[0], 0) / 4;
    const cy = vertices.reduce((sum, point) => sum + point[1], 0) / 4;
    clips.push(`polygon(${vertices.map(([x, y]) => `${cx + (x - cx) * .996}% ${cy + (y - cy) * .996}%`).join(",")})`);
  }
  return clips;
}
const CLIPS = makeClips();

function animateStage(stage: HTMLElement, day: string) {
  const animations: Animation[] = [];
  const digits = stage.querySelector<HTMLElement>(".op-digits");
  if (!digits) return () => undefined;
  const bounds = stage.getBoundingClientRect();
  const size = Math.min(bounds.height * .83, bounds.width * .86 / (day.length * .87));
  digits.style.setProperty("--op-digit-size", `${size}px`);
  const interval = 3000 / (24 * day.length);
  const landingDuration = Math.min(110, interval * .96);
  const animate = (element: Element | null, frames: Keyframe[], delay: number, duration: number) => {
    if (element) animations.push(element.animate(frames, { delay, duration, fill: "both", easing: "linear" }));
  };
  stage.querySelectorAll<HTMLElement>(".op-paper-placement").forEach((paper, index) => {
    const piece = index % 24, row = Math.floor(piece / 4), column = row % 2 ? 3 - piece % 4 : piece % 4;
    const sign = piece % 2 ? 1 : -1;
    paper.style.transformOrigin = `${column * 25 + 12.5}% ${row * 100 / 6 + 100 / 12}%`;
    animate(paper, [
      { opacity: 0, transform: `translate(${sign * size * .045}px,${-size * .09}px) rotate(${sign * 11}deg) scale(1.3)`, filter: "drop-shadow(7px 12px 4px #0004)" },
      { opacity: 1, transform: `translate(${sign * size * .038}px,${-size * .075}px) rotate(${sign * 9}deg) scale(1.25)`, filter: "drop-shadow(6px 10px 3px #0004)", offset: .12, easing: "cubic-bezier(.7,0,1,.6)" },
      { opacity: 1, transform: "translateY(2px) rotate(0deg) scale(1.09,.91)", filter: "drop-shadow(0 1px 0 #0003)", offset: .65, easing: "cubic-bezier(.1,.85,.2,1)" },
      { opacity: 1, transform: "none", filter: "drop-shadow(0 0 0 transparent)" },
    ], 60 + index * interval, landingDuration);
  });
  animate(stage.querySelector(".op-wipe"), [
    { transform: "translateY(115%) rotate(-8deg)", easing: "ease-in-out" },
    { transform: "translateY(-2%) rotate(0)", offset: .5, easing: "ease-in-out" },
    { transform: "translateY(-115%) rotate(5deg)" },
  ], 4700, 800);
  animate(stage.querySelector(".op-finale"), [{ opacity: 0 }, { opacity: 1 }], 5100, 1);
  animate(stage.querySelector(".op-finale img"), [{ transform: "scale(.97)" }, { transform: "none" }], 5100, 400);
  return () => animations.forEach((animation) => animation.cancel());
}

function CountdownStage({ day }: { day: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current ? animateStage(ref.current, day) : undefined, [day]);
  return <div ref={ref} className="op-stage" aria-label={`開催まであと${day}日`}>
    <div className="op-camera"><div className="op-grain" /><div className="op-edge op-edge-red" /><div className="op-edge op-edge-stripe" /><div className="op-edge op-edge-yellow" />
      <div className="op-digits">{[...day].map((digit, digitIndex) => <div className="op-digit" key={`${digit}-${digitIndex}`}>
        {CLIPS.map((clipPath, piece) => <div className="op-paper-placement" key={piece}><div className="op-paper-face" style={{ backgroundPosition: `${+digit % 5 * 25}% ${+digit > 4 ? 100 : 0}%`, clipPath, filter: `saturate(${[1.12, .82, 1, .92][piece % 4]})` }} /></div>)}
      </div>)}</div>
    </div>
    <div className="op-finale"><img src={themeLogoUrl.src} alt="collage 2026" /></div><div className="op-wipe" />
  </div>;
}

export default function OpSplash() {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false), [run, setRun] = useState(0);
  const closed = useRef(false), endTimer = useRef<number | null>(null);
  const clearTimer = () => { if (endTimer.current !== null) window.clearTimeout(endTimer.current); endTimer.current = null; };
  const close = () => {
    if (closed.current) return;
    closed.current = true; clearTimer();
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* unavailable storage */ }
    setVisible(false);
  };
  const show = () => {
    clearTimer(); closed.current = false; setRun(value => value + 1); setVisible(true);
    document.getElementById("op-cover")?.remove(); endTimer.current = window.setTimeout(close, DURATION);
  };
  useEffect(() => {
    let seen = false;
    try { seen = !!sessionStorage.getItem(SESSION_KEY); } catch { /* unavailable storage */ }
    if (seen || reduceMotion || isSlowNetwork()) { closed.current = true; document.getElementById("op-cover")?.remove(); } else show();
    const replay = () => show();
    window.addEventListener(OP_REPLAY_EVENT, replay);
    return () => { clearTimer(); window.removeEventListener(OP_REPLAY_EVENT, replay); };
    // The replay event deliberately owns subsequent runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <AnimatePresence>{visible ? <motion.div className="op-splash" exit={{ opacity: 0 }} transition={{ duration: .3, ease: "easeOut" }}>
    <CountdownStage day={daysToFestival()} key={run} /><button type="button" className="op-skip" aria-label="SKIP" onClick={close}>SKIP ↗</button>
  </motion.div> : null}</AnimatePresence>;
}
