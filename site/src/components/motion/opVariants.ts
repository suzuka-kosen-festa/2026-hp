export const OP_VARIANTS = ["current", "candidate1", "candidate2"] as const;
export type OpVariant = (typeof OP_VARIANTS)[number];

export const OP_DURATIONS: Record<OpVariant, number> = {
  current: 4200,
  candidate1: 3400,
  candidate2: 4000,
};

export function selectOpVariant(saved: string | null, random: () => number): OpVariant {
  if (OP_VARIANTS.includes(saved as OpVariant)) return saved as OpVariant;
  const value = random();
  return OP_VARIANTS[Math.min(2, Math.max(0, Math.floor(value * OP_VARIANTS.length)))];
}
