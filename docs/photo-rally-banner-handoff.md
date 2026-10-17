# 引き継ぎ: ミッションフォトラリーのバナー化

ブランチ: `feature/photo-rally-banner`（`origin/main` の c377150 から作成。2026-10-16 時点で未コミット・未PR）

## なぜやるのか

- ミッションフォトラリーは、記事を読むより**アプリ（https://collage-camera.vercel.app/）を開いてもらう**ことが目的の企画。これまでは他の企画と同じ横長カードで並んでいて、押すと記事ページに飛んでいた。アプリにたどり着くには、記事の中のボタンをもう一度押す必要があった。
- 「常設」枠の中で、フォトラリーだけを目立たせたい。バザーグランプリとわらしべ長者はそこまでアピールしなくてよい（担当判断）。
- そこで、フォトラリーを**バナー広告のような1枚の画像**にした。押すとアプリが直接開く。残りの企画は控えめなカードにした。

## 何をやったか

### 見た目の変化

| ページ | 変更前 | 変更後 |
|---|---|---|
| `/booth/` | 常設枠にフォトラリーの横長カード（PromoCard）。押すと記事ページ | 同じ位置にバナー。押すとアプリ。下に「遊び方・景品を見る →」（記事ページへ） |
| `/timetable/` | 表の下の「常設」に4企画の横長カード | 表の下にフォトラリーのバナー。その下の「常設」には、ゲーム大会・バザーグランプリ・わらしべ長者を小さめのカードで残した |
| `/`（home） | バナー無し | PICK UP の手前にフォトラリーのバナー（`banner` のある企画すべて） |
| `/entry/mission-photo-rally/` | ボタン無し（`link` が null だった） | 「アプリを開く →」ボタンが出る（既存の仕組み。`link` を入れたことで表示されるようになった）。遊び方1の「こちら↗」がアプリへのリンクになる（下の「説明文の中のリンク」） |

- バナーは「貼り付けた紙片」として扱い、黒枠・ハードシャドウ・-0.6°の回転をつけた（design-system.md の方針）。
- PCではバナーの幅を**最大760px・中央寄せ**にした。本文幅いっぱいだと高さが約385pxになり、最初に見える画面の半分を占めてしまったため。
- timetable の小さめのカードは、写真を110px→80px、影を5px→3pxにし、余白・文字・CTAを一回り小さくした。

### 説明文の中のリンク

- `description` に `[テキスト](URL)` と書けるようにした。詳細ページではリンクになり、それ以外（meta description、boothカードで `summary` が無いときの代わりの説明文）では記法を外して「テキスト」だけを出す。URLは `https://` / `http://` / `/` で始まるものだけ有効。
- フォトラリーの遊び方1を「[こちら↗](アプリURL)からイベントスタート」に変えた。HP上ではリンクを直接押せるので、QRコードの案内は削除した。

### バナー画像

| 用途 | 元ファイル | 置き場所 |
|---|---|---|
| PC（900px以上） | `FR_3_1.jpeg`（コピーが横に広がる版） | `site/src/assets/entries/mission-photo-rally-banner.webp` |
| スマホ | `FR_4_1.jpeg`（タイトルが大きい版） | `site/src/assets/entries/mission-photo-rally-banner-sp.webp` |

- 元画像は2枚とも3584×1184（約3:1）。2400px幅・品質85のWebPに変換して置いた。配信用の600/1200/1800px版は、ビルド時に Astro が作る。
- 比率はどちらも同じ3:1。スマホ（約312px幅）では、タイトルが大きい FR_4_1 のほうが読みやすいので、こちらを使い分けた。
- `<picture>` で画面幅に応じて切り替えている。

### 変更したファイル

| ファイル | 内容 |
|---|---|
| `site/src/types/content.ts` | Entry に `banner` / `bannerSp`（JSONに書く）と `bannerPhoto` / `bannerSpPhoto`（ビルド時に付く）を追加 |
| `site/src/data/entries/program.json` | フォトラリーに `banner`・`bannerSp`・`link`・`linkLabel: "アプリを開く →"` を追加 |
| `site/src/lib/entryPhotos.ts` | `withEntryPhotos` がバナー画像も最適化するようにした（バナーは写真より大きい 600/1200/1800px 版を作る） |
| `site/src/components/EntryBanner.tsx` / `.css` | 新規。booth と timetable で共有するバナー部品 |
| `site/src/components/booth/BoothList.tsx` | 常設枠で、`bannerPhoto` のある企画はカードの代わりにバナーを出す |
| `site/src/components/timetable/TimetableList.tsx` / `.css` | バナーを常設一覧の上に分けて出し、残りのカードを小さくした |
| `site/scripts/affected-pages.mjs` | `components/` 直下の `.css` も共通部品として扱うようにした（`EntryBanner.css` だけ直したときにE2Eが走らないのを防ぐ）。`components/entry/InlineLinks.astro` を変えたら `map-game` のE2Eも走るようにした（`map/game.astro` でも使っているため） |
| `site/tests/booth.spec.ts` | テスト追加:「バナーのある常設企画はアプリへ直接飛ぶバナーで出す」 |
| `site/src/components/sections/EntryBanners.astro` | 新規。home の PICK UP の手前に、`banner` のある企画をすべて `EntryBanner` で並べるセクション（静的HTML。画像の最適化は `banner` のある企画だけにかける） |
| `site/src/pages/index.astro` | `EntryBanners` を `ContentsCards` と `FeaturedPromos`（PICK UP）の間に追加 |
| `site/tests/home.spec.ts` | テスト追加:「常設企画のバナーが PICK UP の直前に出て、アプリと記事へつながる」（期待値はデータから引く。`banner` のある企画が無ければ skip、入れば自動で有効） |
| `site/src/data/entries/program.json`（再掲） | フォトラリーの `description` の遊び方1を「[こちら↗](アプリURL)からイベントスタート」に変更 |
| `site/src/lib/inlineLinks.ts` | 新規。`parseInlineLinks`（`[テキスト](URL)` を文字とリンクの並びに分ける）と `stripInlineLinks`（記法を外して文字だけにする）。許可しないURLは書いたままの文字で残す |
| `site/src/components/entry/InlineLinks.astro` | 新規。説明文を受け取り、リンク記法を `<a class="inline-link">`（青・下線、同じタブで開く）にして出す部品 |
| `site/src/pages/entry/[id].astro` | 説明文（`.desc`）を `InlineLinks` で出す。meta description は `stripInlineLinks` で記法を外す |
| `site/src/components/entry/EntryPartSection.astro` | 企画の部門（`parts`）の説明文（`.part-desc`）も `InlineLinks` で出す |
| `site/src/pages/map/game.astro` | ゲーム大会の説明文（`.game-description`）も `InlineLinks` で出す（記法を書いたときに地の文に出ないように） |
| `site/src/components/booth/BoothList.tsx`（再掲） | `summary` が無いときの代わりの説明文を `stripInlineLinks` で文字だけにする（カード全体がリンクになる場合があり、`<a>` を入れ子にできないため） |
| `site/tests/entry.spec.ts` | テスト追加:「説明文にリンクを書いた企画がある（ミッションフォトラリー）」と、記法を含む企画ごとの「説明文のリンクを記法のまま出さない」（対象が0件なら1件目のテストが失敗する） |
| `docs/requirements.md` | `banner` / `bannerSp`・`description` のリンク記法・`link` の説明を追記。フォトラリーのURLのTODOを完了にした |

## 運用方法（非エンジニア向け）

別の企画をバナーにしたいときは、`program.json` などのその企画に次の2行を足し、画像を `site/src/assets/entries/` に置くだけでよい。コードは触らなくていい。

```json
"banner": "/entries/xxx-banner.webp",
"bannerSp": "/entries/xxx-banner-sp.webp",
```

- `bannerSp` は省略できる（その場合はスマホでもPC用の画像を使う）。
- バナーの飛び先は `link`。`link` が null の企画は記事ページに飛ぶ（その場合は「遊び方・景品を見る」は出ない）。
- **バナーが出る条件はページごとに違う。**
  - `/booth/` の常設枠: `isPermanent` の企画のみ（`getPermanentEntries`）
  - `/timetable/` の常設枠: `isPermanent` / `period` / `listInTimetable` の企画（`getOngoingEntries`）
  - home（PICK UP の手前）: `banner` のある企画すべて
- 画像は3:1前後を推奨。スマホでは幅が約310〜520pxになるので、スマホ用は文字を大きく組む。

## 判断したこと・注意点

- **`linkOpens`（公開日）はバナーでは見ていない。** バザーグランプリの投票のように「当日まで押させたくない」導線には `banner` を付けないこと（型のコメントにも書いてある）。必要になったら、`EntryLinkCta` と同じように閲覧時に判定する処理を足す。
- アプリは**同じタブで開く**。既存の「やってみる →」ボタンに合わせた。
- 遊び方・景品・本部での受け取りの説明は記事にしか無いので、バナーの下に記事へのテキストリンクを残した。
- 常設セクションを丸ごと消す案もあった。ただ、ゲーム大会はステージで開催しないため timetable の表に載らず、常設枠にしか出ていない。そのため、3企画は小さくして残した。
- PCのタグフィルタの位置を見るテスト（booth PC）は、常設ブロックの高さに依存している。バナーにしてもこのテストは通っているが、バナーの高さを変えたら再確認すること。

## 確認したこと

- ブラウザ（開発サーバー）で、375px幅と1280px幅の booth / timetable を目視で確認した。横スクロールが出ないこと、スマホでSP用・PCでPC用（1800px版）の画像が選ばれること、リンク先がアプリになっていることを確かめた。
- `npm run check` / `npx playwright test tests/booth.spec.ts tests/timetable.spec.ts tests/entry.spec.ts`: home のバナーと説明文のリンクを足す前に通過（53件、追加したバナーのテストも含む）。
- 全部入れたあとに `npm run check` と全ページの `npx playwright test` を実行: 179件通過・2件skip・失敗0（2026-10-16）。追加したバナー（booth / home）と説明文リンク（entry）のテストは skip されずに実行されている
- TypeScript の型検査はしていない。`astro check` に必要な `@astrojs/check` が入っていないため。
- home のバナーは、ヘッドレスの Chromium で 375px幅と1280px幅だけ確認した。実機の iOS Safari では見ていない。
- timetable のバナーにはE2Eテストが無い（バナーのテストは booth と home だけ）。timetable 側の表示は目視でしか確かめていない。
- 未確認: 実機（iPhone / Android）での見え方。（`types` / `lib` / `data` を変えたので、CIでは全ページのE2Eが走る）

## 残っている作業

1. コミット → PR作成（`Closes #N` を付ける。Projectのカードを `In Review` に移す）
2. **データのスキーマを変えたので、PR前に Discord で一声かける**（共同作業ルール）。変えたのは2点: `content.ts` に `banner` / `bannerSp` を追加したことと、`description` に `[テキスト](URL)` のリンク記法を書けるようにしたこと
3. 必要なら Figma にバナー配置を書き戻し、デザイン担当に確認してもらう（「レイアウトの正解は人間が決める」運用のため）

- `docs/requirements.md` は更新済み（`banner` / `bannerSp`・リンク記法・`link`・フォトラリーのURLのTODO）。仕様書との食い違いは残っていない。
- home の PICK UP の手前にバナーを出す件は対応済み（上の「変更したファイル」）。
