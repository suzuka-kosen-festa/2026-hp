# 第61回鈴鹿高専祭「collage」公式HP

第61回鈴鹿高専祭（2026/10/31 Sat・11/1 Sun、鈴鹿工業高等専門学校）の公式サイト制作ディレクトリ。

## ドキュメント
- [docs/requirements.md](docs/requirements.md) — 要件定義（ページ構成・機能・OPムービー・運用）**←最新の正**
- [docs/design-system.md](docs/design-system.md) — デザインシステム（色・部品・実装技法）
- [design-demo/demo.html](design-demo/demo.html) — 世界観検証デモ（ユーザー承認済み）。実装時の部品シード
- HP設計.md — 初期設計メモ（原本、requirements.md に統合済み）
- ../design.md ・../collage.md — テーマの原典（トーン&マナー、テーマに込めた思い）

## 素材
- ポスター.png — 世界観のリファレンス（迷ったらこれに合わせる）
- テーマロゴ年号入り_透過.png / .svg — テーマロゴ。**SVGは中身PNG埋め込み（Pixelmator出力）で実質ラスター**。拡大用途に使わない
- OP.mp4 — オープニング映像原本（9.8秒 / 1900×906 / 8.5MB）。再エンコード済み版は `site/public/op/`（op.mp4 / op-sp.mp4、音声なしH.264）

## 決定事項
- サイト本体は `site/` 以下に **Astro + 素のCSS** を土台に構築。インタラクション/アニメーションが必要な箇所のみ **React + Framer Motion（`motion`）をアイランドとして追加**（`@astrojs/react`）。詳細は docs/design-system.md §7
- デプロイ: **Cloudflare Pages**。公開URLは自由（ポスターのQRはリダイレクトサイト経由）
- OPムービー: **スプラッシュ型** — 初回訪問のみ・スキップ可・sessionStorage制御。実装済み（`site/src/components/motion/OpSplash.tsx`、home限定）
- 装飾は**コードファースト（SVG/CSS）**。画像生成AIは新規アート素材が必要な場合のみ。Figma書き出しの装飾画像が不透明な矩形パネルの場合は「貼り付けた紙片」として回転+ハードシャドウで見せる（design-system.md参照）
- **レイアウトの正解は人間（Figma）が決め、AIは実装に徹する**（AI単独で新レイアウトを発明しない）。ただしFigmaにフレームが無いSPレイアウト等は、AIがコードで先に作り `generate_figma_design` でFigmaに書き戻して人間がGUIで調整する運用とする
- ヘッダー: PC はFigmaデザイン準拠（横並びnav＋赤テープ下線）、SP はハンバーガー→全画面コラージュメニュー
- コンポーネント確認用に `site/` の `/gallery` ページ（本番導線には含めない、noindex）を維持する。Storybook等の別ツールは導入しない

## 作業ルール
- スマホファースト。プレビューは 375px 幅で確認してから PC 幅を見る
- ちぎれフィルタ（feTurbulence）は `::before` 背景レイヤーのみに適用し、**文字は絶対に歪ませない**
- テープ・チップは**不透明**（半透明は色が薄くなるためNG — フィードバック済み）
- コンテンツ（booth / news / timetable / sponsors）はデータファイルに分離し、非エンジニアでも更新できる形にする
- コミットはユーザーの指示があったときのみ

## 共同作業ルール
- ブランチ運用は GitHub Flow: `main` 直push禁止、作業は `feature/xxx` ブランチ → PR → レビュー後マージ
- 担当はページ単位で分割（例: `feature/booth-page`）し、同一ファイルへの同時編集を避ける
- Header/Footer/`ui/`配下・`global.css`・データファイルのスキーマなど**共通部品への変更はPR前にDiscordで一声かける**（衝突しやすいため）
- `/gallery` はUI実験用ページとして維持しつつ、実験は各自のfeatureブランチ内で行う（gallery専用ブランチの乱立や非追跡化はしない。差分として残し、Discordへのスクショ共有はレビュー依頼の補助として使う）
- コミットメッセージは「何を・なぜ」が一言でわかれば十分（日本語可、Conventional Commits等の厳密なフォーマットは求めない）
