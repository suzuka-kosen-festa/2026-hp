import { withoutDrafts } from "./draft";
import rawSponsors from "../data/sponsors.json";

/**
 * 協賛は Footer と SponsorsSection の2箇所から読まれる。
 * それぞれが data を直接読むと draft の除外を片方だけ忘れるので、ここに集約する。
 */
export const sponsors = withoutDrafts(rawSponsors);
