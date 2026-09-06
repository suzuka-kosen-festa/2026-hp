# 協賛ロゴの入れ方

## 手順

1. 企業から届いた原本を `_originals/` にそのまま置く（ファイル名は日本語のままでよい）
2. 下のコマンドで書き出す。ファイル名は `sponsors.json` の `logo` に書いた名前に合わせる
3. `sponsors.json` の `logo` にそのファイル名を書く

```bash
magick '_originals/<原本>' \
  -colorspace sRGB \
  -background white -alpha remove -alpha off \
  -fuzz 3% -trim +repage \
  -resize '600x200>' \
  -bordercolor white -border 4% \
  -colors 256 -strip \
  <出力名>.png
```

## 各処理の意味

| 処理 | 理由 |
|---|---|
| `-colorspace sRGB` | **最初に必ず通す。** 企業配布のロゴはCMYKのことがある（住友電装がそうだった）。CMYKのまま `-bordercolor white` を使うと、白のつもりが**真っ黒**で塗られる |
| `-background white -alpha remove` | 透過PNGを白地に固定する。スロットの背景は白なので見た目は変わらないが、透過のままだと余白追加時に色が乗らない |
| `-fuzz 3% -trim` | 原本ごとにバラバラな余白を一度落として、大きさの基準を揃える。すでにトリミング済みの原本では何も起きない（第一工業製薬がそう） |
| `-resize '600x200>'` | 表示は最大56px高なので600pxで十分。`>` 付きなので小さい原本は拡大しない |
| `-border 4%` | トリミングで詰めたぶん、一定比率の余白を足し直す。これで全社の見た目の余白が揃う |
| `-colors 256 -strip` | ロゴは色数が少ないのでパレット化がよく効く。Astroがビルド時にwebpへ変換するので、ここでは元の劣化を抑えることだけ考える |

## 確認

書き出したら四隅が白いかを見る。黒ければ colorspace の変換漏れ。

```bash
magick <出力名>.png -format '%[pixel:p{0,0}]' info:
```

## 未着

- 内田鍛工株式会社（`sponsors.json` は `uchida-tanko.png` を参照済み。ファイルを置けば自動で出る）

ロゴが無い協賛は `logo: null` のままでよい。企業名だけのスロットになる。
