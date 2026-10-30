import selection from "../../data/festival-op.json";

export const FESTIVAL_OP_START = Date.parse("2026-10-31T00:00:00+09:00");
export const FESTIVAL_OP_END = Date.parse("2026-11-02T00:00:00+09:00");
export const FESTIVAL_OP_DURATION = 5000;
export const FESTIVAL_SESSION_KEY = "op-seen-festival";
export const FESTIVAL_ATLAS = selection.atlas;
export type OpPeriod = "countdown" | "festival" | "finished";

export function opPeriod(now = Date.now()): OpPeriod {
  return now < FESTIVAL_OP_START ? "countdown" : now < FESTIVAL_OP_END ? "festival" : "finished";
}

function shuffled<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 選別した55件を毎回1枚ずつ使用。配置・貼る順・ずり落ちる順を別々に崩す。
export function createFestivalTiles(random = Math.random) {
  const photos = selection.photos.map((number, atlasIndex) => ({ number, atlasIndex }));
  const indices = Array.from({ length: photos.length }, (_, index) => index);
  const order = shuffled(indices, random), fallOrder = shuffled(indices, random);
  return shuffled(photos, random).map((photo, index) => ({
    ...photo, order: order[index], fallOrder: fallOrder[index], tilt: (random() - .5) * 40,
    left: index % 5 * 25 + (random() - .5) * 17,
    top: Math.floor(index / 5) % 5 * 25 + (random() - .5) * 13,
  }));
}
