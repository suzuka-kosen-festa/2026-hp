# デザインシステム — collage 2026

最終更新: 2026-07-17
実装サンプル: [../design-demo/demo.html](../design-demo/demo.html)（ユーザー承認済み）。本実装後は `site/` の `/gallery` ページが実コンポーネントの一覧として最新

## 0. 世界観の原則

- **ポスター.png が世界観の正**。迷ったらポスターに合わせる
- キーワード: cut & paste / mixed media / editorial / ZINE / DIY / playful
- 「整いすぎていない完成度」— 微妙な回転・重なり・ズレはOK、ただし**情報整理は明確に**
- Avoid: コーポレート風 / Appleミニマル / サイバーUI / グラスモーフィズム / 過剰アニメ / 綺麗すぎるレイアウト
- **レイアウトはFigmaのデザインが正**。AIは部品の品質と実装に責任を持ち、構図を勝手に発明しない

## 1. カラー

```css
:root {
  --blue:   #1A33D6;
  --red:    #E31B23;
  --yellow: #F4D21F;
  --ink:    #111111;
  --paper:  #F8F8F8;
}
```

- 使用比率の目安: paper(地) ≫ ink(文字) > 赤・青(強調を交互に) > 黄(アクセント)
- 曜日色の慣例: SAT=青、SUN=赤（ポスター準拠）
- テープ・チップは**不透明**。半透明は白地で色が薄くなるためNG（確認済みフィードバック）

## 2. タイポグラフィ

| 用途 | フォント | 備考 |
|---|---|---|
| 和文本文・見出し | Noto Sans JP（400 / 700 / 900） | 本番は `@fontsource/noto-sans-jp` で自前ホスト |
| 日付・ヘッダーnav等の欧文数字/見出し | Bebas Neue | Figma実データで確認（`.num`）。デモ作成時点の想定「Anton」から変更 |
| ヘッダーロゴ「SUZUKA KOSEN FESTIVAL」 | Murecho（Bold） | Figmaデザインで確認。`--font-logo` |
| SAT / SUN 縦書きラベル | Courier Prime（Bold） | Figmaデザインで確認。`--font-day` |
| 手書きアクセント | 未定 | ポスター「2026」の筆記体風。使用箇所を限定 |

- 数字クラス `.num` で欧文数字フォントを適用する運用（デモ準拠）

## 3. 部品カタログ（demo.html 実装済み）

| 部品 | 用途 | 実装メモ |
|---|---|---|
| マスキングテープ | 見出し・ラベル | `::before` にちぎれフィルタ。色は `--tape-bg` で切替 |
| タグチップ | boothカードのタグ、NEWバッジ | テープの小型版。±2〜3°回転 |
| 破れ紙 | 背景装飾 | 単色矩形 + `#torn-edge` フィルタ |
| パターン（ハーフトーン/市松/ストライプ) | 背景装飾・面の充填 | SVG `<pattern>`。破れフィルタと併用可 |
| 星 | 散らし装飾 | テキスト「★」に色・回転。軽量でくっきり |
| スターバースト | 散らし装飾 | `<polygon>` をJSで生成（spikes/外径/内径） |
| ハードシャドウカード | booth・contentsカード | 白地 + 2px枠 + `box-shadow: 5px 5px 0 var(--ink)`、±1°回転 |
| マーキー | ページ上端の帯 | 黒地白文字、CSS animation。reduced-motionで停止 |
| ボタン | CTA | テープと同技法。hoverで逆回転+scale |
| ニュース行 | home/news | 日付(青・num) + NEWチップ + 破線区切り |
| 区切りテープ | セクション境界 | 全幅の細テープ、±1°回転 |

## 4. 実装技法（重要）

### ちぎれ・破れフィルタ
```svg
<filter id="tape-edge">  <!-- テープ端: 弱め -->
  <feTurbulence type="fractalNoise" baseFrequency="0.045 0.28" numOctaves="3" seed="7"/>
  <feDisplacementMap in="SourceGraphic" scale="7"/>
</filter>
<filter id="torn-edge">  <!-- 紙の破れ: 強め -->
  <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="4" seed="3"/>
  <feDisplacementMap in="SourceGraphic" scale="14"/>
</filter>
```

- **フィルタは文字に掛けない**。要素本体ではなく `::before`（背景レイヤー、`z-index:-1`）に適用する
- `seed` を変えると同じ部品でも違うちぎれ方になる。並ぶ要素はseedを散らす
- 紙の質感: `body::after` に turbulence ノイズ画像を `opacity: 0.05` で全面重ね

### 回転の目安
- テープ・カード: -3°〜+3°（隣接要素で向きを変える。全部同じ角度は「AIくさく」なる）
- 散らし装飾（星・破れ紙): -15°〜+15°

### Figma書き出し画像の扱い（実装時の学び）
- Figmaの装飾用ラスター画像（背景テクスチャ、AI生成イラスト等）は**透過ではなく不透明な矩形パネル**として書き出されることが多い。透過前提で背景に溶け込ませようとすると不自然な黒い矩形が浮いて見える
- この手のアセットは無理に透過処理せず、**「貼り付けた紙片」として矩形のまま回転+ハードシャドウ（`drop-shadow`）で見せる**とコラージュの世界観に馴染む（`hero-right`、SPONSORS背景テクスチャで採用）
- Figma上でノードが空（アイコン等が未配置）の場合は、レイヤー名が指す標準アイコンセット（例: Ionicons）の本家SVGを代替として使う方が、ラスター書き出しより高品質

## 5. ヘッダー仕様

### PC（約900px以上）— Figmaデザイン準拠
- 左: 「SUZUKA KOSEN FESTIVAL」3行組みロゴテキスト（黒・極太）
- 右: HOME / TIMETABLE / MAP / BOOTH / ACCESS / SPONSORS / NEWS 横並び
- 下線: 赤テープ風。hover と現在ページに表示

### SP — ハンバーガー + 全画面コラージュメニュー
- 固定細バー: 左に小ロゴ、右にハンバーガー（三本線をテープ3枚で表現）
- 開くと全画面オーバーレイ: 7項目を大きめテープで縦積み（角度を散らす）、背景に星・市松を散らし
- 閉じるボタンは「✕」テープ。スクロールロックする
- 開閉アニメーションはFramer Motion（`AnimatePresence`）で実装（`site/src/components/motion/HamburgerMenu.tsx`）

### 実装状況（2026-07-17時点）
- PC/SPともに `site/` で実装済み。PCはFigmaのnode `584:935` に準拠
- SPはFigmaにフレームが無かったため、AIがモバイルファーストでコードから実装 → `generate_figma_design` で同一Figmaファイルに書き戻し済み（node `647:473`「SP案（AI生成）」）。今後Figma上での人間側の調整を反映する場合はこのフレームを更新してコードに戻す

## 6. OPスプラッシュの見せ方

- 動画終了 or スキップ → ロゴヒーローへクロスフェード（0.3s程度、過剰演出はしない)
- スキップボタンは黒テープ風「SKIP →」を右下に常時表示

## 7. アニメーション（Astro + React islands）

- 基本はAstro単体・素のCSS。スクロール登場演出やジェスチャー操作など複雑な動きが要る箇所のみ、React + Framer Motion（`motion`パッケージ）を「アイランド」として個別に読み込む（`client:visible` / `client:idle`）
- ファーストビュー（ヒーロー）はLCP保護のためReactに依存しない素のCSSアニメーションのみとする
- 共通のスクロール登場演出は `site/src/components/motion/Reveal.tsx`（`whileInView` + `useReducedMotion()`）を使う
- `prefers-reduced-motion` はCSS側の `@media` とFramer Motion側の `useReducedMotion()` の両方で止める
