import type { ImageMetadata } from "astro";
import { getImage } from "astro:assets";
import type { Entry, EntryPhoto } from "../types/content";

/**
 * 企画写真のビルド時最適化。
 *
 * データ（entries/*.json）には `"image": "/entries/xxx.webp"` と書き、ファイルは
 * src/assets/entries/ に置く。public/ に置くと書いたファイルがそのまま配信され、
 * スマホの小さなカードにも1200px幅の画像を送ってしまうため、Astro の画像処理に通して
 * 幅違いの版（srcset）と縦横の寸法を作る。
 *
 * getImage はサーバー側（.astro）でしか使えないので、Reactアイランドには
 * 最適化済みの結果を `photo` として付けた entries を渡す（withEntryPhotos）。
 */
const files = import.meta.glob<ImageMetadata>("../assets/entries/*.{webp,png,jpg,jpeg}", {
  eager: true,
  import: "default",
});

const byDataPath = new Map(
  Object.entries(files).map(([file, meta]) => [`/entries/${file.split("/").pop()}`, meta]),
);

/** 作る幅。元画像より大きい幅は作らない（拡大しても綺麗にならず容量だけ増える） */
const WIDTHS = [400, 800, 1200];

/**
 * データの image パスから最適化済みの写真を作る。
 * ファイルが無いときはビルドを止める。パスの書き間違いを本番で「写真が出ない」まま
 * 見逃さないため
 */
export async function optimizeEntryPhoto(path: string): Promise<EntryPhoto> {
  const meta = byDataPath.get(path);
  if (!meta) {
    throw new Error(
      `[entryPhotos] 画像 "${path}" が見つかりません。src/assets/entries/ にファイルを置き、image には "/entries/ファイル名" と書いてください`,
    );
  }
  const widths = WIDTHS.filter((w) => w < meta.width).concat(Math.min(meta.width, WIDTHS[WIDTHS.length - 1]));
  const image = await getImage({ src: meta, widths, format: "webp" });
  return {
    src: image.src,
    srcset: image.srcSet.attribute,
    width: meta.width,
    height: meta.height,
  };
}

/** Reactアイランドに渡す前に、各エントリへ最適化済みの写真（photo）を付ける */
export async function withEntryPhotos(entries: Entry[]): Promise<Entry[]> {
  return Promise.all(
    entries.map(async (entry) => (entry.image ? { ...entry, photo: await optimizeEntryPhoto(entry.image) } : entry)),
  );
}
