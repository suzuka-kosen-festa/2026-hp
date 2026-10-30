export const OP_VARIANTS = ["current", "candidate1", "candidate2"] as const;
// 当日用OPを用意するまでは、開催初日の日本時間0時以降は再生しない。
export const OP_COUNTDOWN_END = Date.parse("2026-10-31T00:00:00+09:00");
export type OpVariant = (typeof OP_VARIANTS)[number];

export const OP_DURATIONS: Record<OpVariant, number> = {
  current: 2400,
  candidate1: 3400,
  candidate2: 4000,
};

export function selectOpVariant(saved: string | null, random: () => number): OpVariant {
  if (OP_VARIANTS.includes(saved as OpVariant)) return saved as OpVariant;
  const value = random();
  return OP_VARIANTS[Math.min(2, Math.max(0, Math.floor(value * OP_VARIANTS.length)))];
}
