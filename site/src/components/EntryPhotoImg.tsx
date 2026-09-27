import type { Entry } from "../types/content";

interface Props {
  entry: Entry;
  /** 表示幅。ブラウザはこれを見て srcset から画面に合った幅を選ぶ（例: "110px"） */
  sizes: string;
}

/**
 * 企画写真の <img>。entry.photo（ページ側で withEntryPhotos が付けた最適化済みの写真）から
 * srcset と縦横の寸法を出す。photo が無いのは写真の無い企画なので何も出さない
 */
export default function EntryPhotoImg({ entry, sizes }: Props) {
  if (!entry.photo) return null;
  const { src, srcset, width, height } = entry.photo;
  return <img src={src} srcSet={srcset} sizes={sizes} width={width} height={height} alt="" loading="lazy" decoding="async" />;
}
