import sponsorsData from "../data/sponsors.json";

/**
 * 協賛データの唯一の入口。
 *
 * Footer と SponsorsSection の2箇所から読まれる。それぞれが data/ を直接読むと、
 * 絞り込みや並び替えを足したときに片方だけ直し忘れる（実際に起きた）。
 * 消費側はこの配列を受け取るだけでよい。
 */
export const sponsors = sponsorsData;
