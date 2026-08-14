import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  rotate?: number;
  className?: string;
}

export default function Reveal({ children, delay = 0, y = 24, rotate = -1, className }: RevealProps) {
  const shouldReduceMotion = useReducedMotion();

  // 【重要】shouldReduceMotion は「描画結果に影響しないもの」にしか使わないこと。
  // この値はサーバーでは常に false になるため、これでマークアップを分岐させると
  // SSRとクライアントで別物を描くことになる。
  //
  // 以前はこの値で「返す要素の種類」を切り替えて素の <div> を返しており、
  // サーバーが焼き込んだ opacity:0 を消す担当がクライアント側から消えた結果、
  // 低減設定の端末ではセクションが丸ごと見えなくなっていた。
  // initial だけを出し分ける形にしても、今度はハイドレーション不一致の警告が出る。
  //
  // そこで initial は両者で完全に同じにし、低減設定の面倒は
  // global.css の [data-reveal]（ハイドレーション前から効く）と、
  // ここでの transition: 0（動かさない）の2つで見る。
  return (
    <motion.div
      data-reveal
      className={className}
      style={{ "--reveal-rotate": `${rotate}deg` } as CSSProperties}
      initial={{ opacity: 0, y, rotate: rotate * 2 }}
      whileInView={{ opacity: 1, y: 0, rotate }}
      viewport={{ once: true, margin: "-60px" }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
