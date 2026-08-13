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

### 1. Node のバージョン管理ツールを入れる（初回のみ）

このリポジトリは **Node のバージョンを `.node-version`（24.19.0）に固定**しています。システムに入れた Node を直接使うとバージョンがずれるため、切り替えツールを入れてください。すでに nvm 等を使っているならこの手順は不要です。

未導入なら [fnm](https://github.com/Schniz/fnm) を勧めます。軽量で、`.node-version` をそのまま読んでくれます。

```sh
# macOS
brew install fnm

# Windows
winget install Schniz.fnm
```

インストール後、**シェルの設定ファイルに次の1行を追記**してください（`~/.zshrc` など）。これが無いとディレクトリ移動時の自動切り替えが働きません。

```sh
eval "$(fnm env --use-on-cd --shell zsh)"
```

追記したらターミナルを開き直します。

### 2. クローンして Node を用意する

```sh
git clone https://github.com/suzuka-kosen-festa/2026-hp.git
cd 2026-hp
fnm install
```

`fnm install` は `.node-version` を読んで 24.19.0 を入れ、そのまま有効化します。確認：

```sh
node -v   # v24.19.0 と出れば OK
```

nvm を使っている場合はこちら（nvm は `.node-version` を読まないため、明示的に渡します）。

```sh
nvm install $(cat .node-version)
nvm use $(cat .node-version)
```

### 3. 依存をインストールして起動する

```sh
cd site
npm ci
npm run dev
```

`http://localhost:4321` で確認できます。

`npm ci` が `EBADENGINE` で止まる場合は、Node のバージョンが合っていません。手順2に戻って `node -v` が `v24.19.0` になっているか確認してください。

### `npm install` と `npm ci` の使い分け

| 目的 | コマンド |
|---|---|
| クローン直後・ブランチ切替後の環境構築 | `npm ci` |
| パッケージを**追加・更新する**とき | `npm install <pkg>` |

**依存を変えないときに `npm install` を使わないでください。** `npm install` は `package-lock.json` を書き換えるため、内容が同じでも npm のバージョン差でフォーマットの揺れが差分として出ます。`npm ci` はロックファイルを読むだけで書き換えないので、この事故が起きません。

Node のバージョンが合っていない場合は `engine-strict` によりインストール時にエラーで止まります（黙ってロックが書き換わるのを防ぐため）。

> [!IMPORTANT]
> **npm コマンドは必ず `site/` に `cd` してから実行してください。** リポジトリルートから `npm ci --prefix site` のように実行すると `site/.npmrc` が読み込まれず、`engine-strict` によるバージョンチェックが効きません。

## デプロイ・プレビュー

- `main` への push → 本番 (`snct-fes-2026.pages.dev`) に自動デプロイ
- PRを作成 → GitHub Actions が build・デプロイし、**PRのコメントにプレビューURLが自動投稿される**（レビュー時はそのURLを開いて確認する）

## 共同作業

ブランチ運用は GitHub Flow（`main` 直push禁止、`feature/xxx` ブランチ → PR → レビュー後マージ）。詳細なルール（担当分割・共通部品変更時の注意・コミットメッセージの指針など）は [AGENTS.md](AGENTS.md) を参照。
