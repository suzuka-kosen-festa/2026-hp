# 第61回鈴鹿高専祭「collage」公式HP

第61回鈴鹿高専祭（2026/10/31 Sat・11/1 Sun、鈴鹿工業高等専門学校）の公式サイト。

- 本番: https://snct-fes-2026.pages.dev

## ディレクトリ構成

| パス | 内容 |
|---|---|
| `site/` | サイト本体（Astro + React）。開発はここで行う |
| [`docs/requirements.md`](docs/requirements.md) | 要件定義（ページ構成・機能） |
| [`docs/design-system.md`](docs/design-system.md) | デザインシステム（色・部品・実装技法） |
| [`AGENTS.md`](AGENTS.md) | 開発の決定事項・作業ルール・共同作業ルール（AIツールが参照する開発ガイド） |

## 開発環境の始め方

```sh
cd site
npm install
npm run dev
```

`http://localhost:4321` で確認できます。

## デプロイ・プレビュー

- `main` への push → 本番 (`snct-fes-2026.pages.dev`) に自動デプロイ
- PRを作成 → GitHub Actions が build・デプロイし、**PRのコメントにプレビューURLが自動投稿される**（レビュー時はそのURLを開いて確認する）

## 共同作業

ブランチ運用は GitHub Flow（`main` 直push禁止、`feature/xxx` ブランチ → PR → レビュー後マージ）。詳細なルール（担当分割・共通部品変更時の注意・コミットメッセージの指針など）は [AGENTS.md](AGENTS.md) を参照。
