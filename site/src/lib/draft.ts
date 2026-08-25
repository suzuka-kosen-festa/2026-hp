/**
 * 未確定データを本番ビルドだけで隠す仕組み（Issue #48）。
 *
 * 実装がデータより先に進むため、動作確認用のダミーが data/ に置かれたままになる。
 * 消すとレイアウト確認ができず、残すと公開されてしまう。そこで `draft: true` を
 * 付けたものを本番ビルドでだけ落とす。
 *
 * 判定はビルド時のみ。ブラウザには渡らない。
 *
 * - プレビュー（PR）    … INCLUDE_DRAFTS=1 → draft も出る（レイアウト確認できる）
 * - 本番（mainへのpush）… 未設定          → draft は消える
 *
 * 値は .github/workflows/deploy.yml が渡す。Cloudflare のビルド環境ではなく
 * GitHub Actions でビルドしているので、CF_PAGES_BRANCH のような変数は使えない。
 */
export const INCLUDE_DRAFTS = process.env.INCLUDE_DRAFTS === "1";

/** `draft: true` を持つものを本番ビルドで落とす。消費側はこれを通すだけでよい */
export function withoutDrafts<T extends { draft?: boolean }>(items: T[]): T[] {
  if (INCLUDE_DRAFTS) return items;
  return items.filter((item) => !item.draft);
}
