/**
 * 企画の説明文（entries/*.json の description）に埋め込むリンクの扱い。
 *
 * 非エンジニアでもJSONを書き換えるだけでリンクを足せるよう、Markdownと同じ
 * `[テキスト](URL)` の書き方だけを受け付ける。HTMLを直接書かせないのは、
 * タグの閉じ忘れや意図しない埋め込みでページが壊れるのを避けるため。
 *
 * URL は https:// / http:// / サイト内の "/" 始まりだけを通す。それ以外
 * （javascript: や書き間違い）はリンクにせず、書いたままの文字として出す。
 */

export type InlineSegment = { type: "text"; text: string } | { type: "link"; text: string; href: string };

// [テキスト](URL)。テキストに ] 、URLに空白と ) は含められない
const LINK_PATTERN = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

function isAllowedHref(href: string): boolean {
  // "//example.com" は別サイトに飛ぶので、サイト内リンク扱いにしない
  return /^https?:\/\//.test(href) || (href.startsWith("/") && !href.startsWith("//"));
}

/** 文字列を「ただの文字」と「リンク」の並びに分ける */
export function parseInlineLinks(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let last = 0;
  let plain = "";
  for (const match of text.matchAll(LINK_PATTERN)) {
    const [whole, label, href] = match;
    const index = match.index ?? 0;
    plain += text.slice(last, index);
    last = index + whole.length;
    if (!isAllowedHref(href)) {
      // 許可しないURLは書いたままの文字として残す
      plain += whole;
      continue;
    }
    if (plain) segments.push({ type: "text", text: plain });
    plain = "";
    segments.push({ type: "link", text: label, href });
  }
  plain += text.slice(last);
  if (plain) segments.push({ type: "text", text: plain });
  return segments;
}

/** リンクの書き方を外して文字だけにする（meta description や一覧カードの紹介文用） */
export function stripInlineLinks(text: string): string;
export function stripInlineLinks(text: string | null | undefined): string | null | undefined;
export function stripInlineLinks(text: string | null | undefined) {
  if (text == null) return text;
  return parseInlineLinks(text)
    .map((segment) => segment.text)
    .join("");
}
