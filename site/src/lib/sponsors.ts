import sponsorsData from "../data/sponsors.json";

/**
 * 協賛データの唯一の入口。
 *
 * Footer と SponsorsSection の2箇所から読まれる。それぞれが data/ を直接読むと、
 * 絞り込みや並び替えを足したときに片方だけ直し忘れる（実際に起きた）。
 * 消費側はこの配列を受け取るだけでよい。
 */
export const sponsors = sponsorsData;

/**
 * 特別協賛（type: "special"）。/sponsors の先頭と home の専用セクションに出す。
 * 法人協賛とは別枠で、会社ロゴに加えてプロダクトロゴ（products）を並べる。
 * 金額は他の協賛と同じく持たせない（公開リポジトリのため）
 */
export const specialSponsors = sponsorsData
  .filter((s) => s.type === "special")
  .map((s) => ({ ...s, products: s.products ?? [] }));

const logoFiles = import.meta.glob<ImageMetadata>("../assets/sponsors/*.{png,jpg,jpeg,webp}", {
  eager: true,
  import: "default",
});

/** sponsors.json の logo（ファイル名）から画像を引く。未着なら null */
export function getSponsorLogo(filename?: string | null) {
  if (!filename) return null;
  return logoFiles[`../assets/sponsors/${filename}`] ?? null;
}

/**
 * 特別協賛のリンクに付けるUTM。先方の解析ツールで「高専祭HPから来た人」を
 * 数えられるようにする。どの枠から来たかは content で分ける（例: home / footer）。
 * data には素のURLを置き、ここで付ける（JSONを非エンジニアが直すときに崩さないため）
 */
export function withUtm(url: string, content: string) {
  const u = new URL(url);
  u.searchParams.set("utm_source", "snct-fes");
  u.searchParams.set("utm_medium", "referral");
  u.searchParams.set("utm_campaign", "kosensai2026");
  u.searchParams.set("utm_content", content);
  return u.toString();
}

/**
 * 協賛名を折り返しの単位に分ける。「株式会社クラフトワークス」が
 * 「株式会社クラフトワ / ークス」のように語の途中で割れないよう、
 * 法人格・スペース・カタカナと漢字の切り替わりでだけ折り返せるようにする
 * （「ハートフルクリニック / 北井内科」「ガット張り専門店 / キートス」）。
 * 区切りは「折り返してよい位置」なので、枠に収まる名前は1行のまま。
 * スペースは区切りとして残す（英字の個人名で語間が消えないように）
 */
const NAME_BREAK = /(株式会社|有限会社|合同会社|医療法人|[ 　]+)/;
const SCRIPT_BREAK = /(?<=[\p{sc=Katakana}ー])(?=\p{sc=Han})|(?<=[\p{sc=Han}\p{sc=Hiragana}])(?=\p{sc=Katakana})/u;
export function splitSponsorName(name: string) {
  return name
    .split(NAME_BREAK)
    .filter((t) => t !== "")
    .flatMap((t) => (/^[ 　]+$/.test(t) ? [t] : t.split(SCRIPT_BREAK)))
    .map((t) => ({ text: t, isSpace: /^[ 　]+$/.test(t) }));
}
