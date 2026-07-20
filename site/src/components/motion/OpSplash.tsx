import { useEffect, useState, useRef } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import "./OpSplash.css";

const SESSION_KEY = "op-seen";
// ロゴクリックなどから再生要求を受け取るためのカスタムイベント名
export const OP_REPLAY_EVENT = "op:replay";
// 再生が始まらないまま固まった場合のみ発動する猶予時間（再生開始後はonEndedに任せる）
const START_FAILSAFE_MS = 5000;

// OP.mp4の元解像度。動画は6〜7秒あたりでロゴが組み上がって静止する
const VIDEO_ASPECT = 1900 / 906;
// そのロゴ完成フレーム内で「collage 2026」ロゴ本体が占める領域（フレーム全体に対する比率）。
// /tmp/op-frames/f6_5.png を実測して算出
const LOGO_FRAME = { top: 0.2097, bottom: 0.8411, left: 0.1537, right: 0.8563 };

// devモードのVite CSS注入(JS経由)がDOM挿入より一瞬遅れることがあり、
// その間<video>が本来サイズ(960/1900px)で描画されて横スクロールが発生しうる。
// レイアウトに関わる指定はスタイルシート読み込みを待たないinline styleで即時固定する
const baseVideoStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  maxWidth: "100%",
  objectFit: "contain",
  display: "block",
};

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
};

function isSlowNetwork(): boolean {
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  if (conn.effectiveType && ["slow-2g", "2g"].includes(conn.effectiveType)) return true;
  return false;
}

// 動画のロゴ完成カットが、実際のヒーローロゴと画面上で同じ位置に来るよう
// object-position を逆算する（object-fit:containは全体を縮小表示するだけで
// トリミングしないので、余白の配分をずらすだけで動画の中身は欠けない）
function computeLogoAlignedObjectPosition(): string {
  const heroLogo = document.querySelector<HTMLElement>(".hero-logo");
  if (!heroLogo) return "50% 50%";

  const rect = heroLogo.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return "50% 50%";

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const targetX = rect.left + rect.width / 2;
  const targetY = rect.top + rect.height / 2;
  const containerAspect = vw / vh;

  let posX = 50;
  let posY = 50;

  if (VIDEO_ASPECT > containerAspect) {
    // 横幅いっぱいにフィットし、上下に余白ができるケース（縦長スマホなど）
    const displayedH = vw / VIDEO_ASPECT;
    const extraH = vh - displayedH;
    if (extraH > 0) {
      const logoCenterFrac = (LOGO_FRAME.top + LOGO_FRAME.bottom) / 2;
      const topOffset = targetY - logoCenterFrac * displayedH;
      posY = Math.min(100, Math.max(0, (topOffset / extraH) * 100));
    }
  } else {
    // 縦幅いっぱいにフィットし、左右に余白ができるケース（横長デスクトップなど）
    const displayedW = vh * VIDEO_ASPECT;
    const extraW = vw - displayedW;
    if (extraW > 0) {
      const logoCenterFracX = (LOGO_FRAME.left + LOGO_FRAME.right) / 2;
      const leftOffset = targetX - logoCenterFracX * displayedW;
      posX = Math.min(100, Math.max(0, (leftOffset / extraW) * 100));
    }
  }

  return `${posX}% ${posY}%`;
}

export default function OpSplash() {
  const shouldReduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [objectPosition, setObjectPosition] = useState("50% 50%");
  const closedRef = useRef(false);
  const startFailSafeRef = useRef<number | null>(null);

  function clearStartFailSafe() {
    if (startFailSafeRef.current !== null) {
      window.clearTimeout(startFailSafeRef.current);
      startFailSafeRef.current = null;
    }
  }

  function close() {
    if (closedRef.current) return;
    closedRef.current = true;
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* Safari private mode等でsessionStorageが使えない場合は無視 */
    }
    setVisible(false);
  }

  function show() {
    setObjectPosition(computeLogoAlignedObjectPosition());
    setVisible(true);
    document.getElementById("op-cover")?.remove();
  }

  useEffect(() => {
    let alreadySeen = false;
    try {
      alreadySeen = !!sessionStorage.getItem(SESSION_KEY);
    } catch {
      alreadySeen = false;
    }

    if (alreadySeen || shouldReduceMotion || isSlowNetwork()) {
      closedRef.current = true;
      document.getElementById("op-cover")?.remove();
    } else {
      show();
      startFailSafeRef.current = window.setTimeout(close, START_FAILSAFE_MS);
    }

    // ロゴクリック等からの明示的な再生要求。ユーザーの意図的な操作なので
    // reduced-motion/低速回線のガードは適用しない
    function handleReplay() {
      clearStartFailSafe();
      closedRef.current = false;
      show();
    }
    window.addEventListener(OP_REPLAY_EVENT, handleReplay);

    return () => {
      clearStartFailSafe();
      window.removeEventListener(OP_REPLAY_EVENT, handleReplay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div className="op-splash" exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
          <video
            className="op-video"
            style={{ ...baseVideoStyle, objectPosition }}
            autoPlay
            muted
            playsInline
            onPlaying={clearStartFailSafe}
            onEnded={close}
            onError={(e) => {
              // 複数<source>のうちmedia不一致でスキップされた側の再生試行が、
              // videoElement.error=null のダミーerrorイベントとしてバブルすることがある。
              // 実際に再生失敗した(error情報がある)ときだけフォールバックする
              if (e.currentTarget.error) close();
            }}
          >
            <source src="/op/op-sp.mp4" media="(max-width: 700px)" type="video/mp4" />
            <source src="/op/op.mp4" type="video/mp4" />
          </video>
          <button type="button" className="op-skip" onClick={close}>
            SKIP →
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
