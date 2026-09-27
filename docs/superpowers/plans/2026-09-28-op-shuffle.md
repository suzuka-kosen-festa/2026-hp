# OP演出3種シャッフル Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 初回訪問時に3種類のOPから等確率で1本を表示し、同じタブの再再生ではその1本を固定する。

**Architecture:** `OpSplash` が抽選・保存・共通の終了処理を担い、各演出コンポーネントが自身の表示とタイムラインを担う。候補1・2は保存済み試作の演出だけを移植し、サイト内の素材を使う。

**Tech Stack:** Astro 7、React 19、Web Animations API、CSS、Playwright。

**Spec:** `docs/superpowers/specs/2026-09-28-op-shuffle-design.md`

## Global Constraints

- 既存の未コミット変更を保持する。`OpSplash.tsx`、`OpSplash.css`、`home.spec.ts` は作業前に差分を確認する。
- コミットはユーザーが明示指示した場合のみ。計画中の各タスクはテストまで行い、コミットしない。
- 追加依存なし。`npm` コマンドは `site/` から実行し、Nodeは `.node-version` の24.19.0を使う。
- 初回のみ表示、SKIP、ロゴ再再生、低減モーション・低速回線スキップ、開催日の日数計算を維持する。
- 375px幅を先に検証し、その後PC幅を検証する。`npm run check` を通す。

## Review Focus

- `sessionStorage` が使えない環境でもOPが表示され、同一マウント内の再再生で種類が変わらない。
- 保存キーに未知の値が入っていても有効な1種に選び直す。
- 再再生中の再再生イベントで旧タイマー・旧アニメーションが残らない。
- 候補2の黄色いワイプ後に数字が再露出しない。
- 候補ごとに所要時間が異なっても、終了・スキップ後にOPと事前カバーが残らない。

---

### Task 1: 演出選択と共通制御

**Files:**
- Create: `site/src/components/motion/opVariants.ts`
- Modify: `site/src/components/motion/OpSplash.tsx`
- Modify: `site/tests/home.spec.ts`

**Interfaces:**
- `type OpVariant = "current" | "candidate1" | "candidate2"`
- `const OP_VARIANTS: readonly OpVariant[]`
- `const OP_DURATIONS: Record<OpVariant, number>`、単位はms、値は4200・3400・4000
- `selectOpVariant(saved: string | null, random: () => number): OpVariant`
- `OpSplash` は選択済みIDを保持し、表示中の演出と終了タイマーを同じIDに対応させる。

- [ ] **Step 1: 失敗するテストを書く** `selectOpVariant` の境界値（0、1/3、2/3、1未満）、未知の保存値、保存値優先を検証する。E2Eでは初回と再再生で演出IDが同じ、別セッションで保存値なしなら再選択、SKIPと終了後にカバーなし、保存先利用不可でも動作することを確認する。既存の現行OP固定テストはIDを固定して検証する。
- [ ] **Step 2: テストを実行して失敗を確認する** `site/` で `npx playwright test tests/home.spec.ts`。関数単体のテストは既存テスト基盤に合わせ、必要ならE2Eの `page.evaluate` でブラウザ内の選択境界を検証する。期待: 新仕様のアサーションがFAIL。
- [ ] **Step 3: 選択・保存・再生タイマーを実装する** 保存キーは `op-variant`。抽選は初回の1回だけ、再再生では選択IDを再利用する。未知値は再抽選し、保存できない場合はReact状態で維持する。再再生時は旧タイマーを必ず解除する。演出識別用に `data-op-variant` をスプラッシュに付ける。
- [ ] **Step 4: テストを再実行してPASSを確認する** `npx playwright test tests/home.spec.ts`。まだ未移植の候補は仮の描画でよいが、選択・タイマー・共通制御は動作させる。

### Task 2: 候補1「開幕前」を移植

**Files:**
- Create: `site/src/components/motion/OpCandidate1.tsx`
- Create: `site/src/components/motion/OpCandidate1.css`
- Add: `site/public/op/candidate1-digits.png`（保存済み `候補1/assets/digits.png`）
- Modify: `site/src/components/motion/OpSplash.tsx`
- Modify: `site/tests/home.spec.ts`

**Interfaces:**
- `OpCandidate1({ day }: { day: string })`。親から日数を受け、試作 `v2.js` の `countdown` モードを3.4秒で再現する。
- アンマウント時にWeb Animationsをすべて `cancel()` する。

- [ ] **Step 1: 候補1を固定したE2Eテストを書く** `op-variant=candidate1` を初回ナビゲーション前に設定し、候補1の紙片、日数、3.4秒後の終了、SKIP、再再生で同じIDを確認する。375pxとPC幅でロゴ・数字がステージ内に収まることも検証する。
- [ ] **Step 2: E2Eを実行してFAILを確認する** `npx playwright test tests/home.spec.ts`。
- [ ] **Step 3: 試作の演出部分を移植する** `v2.html/css/js` の `countdown` モードのみを取り込み、試作の操作パネル・他モードは除く。ロゴはサイト既存の素材を使う。
- [ ] **Step 4: E2Eを再実行してPASSを確認する** `npx playwright test tests/home.spec.ts`。375pxのスクリーンショットを先に、次にPCで視覚確認する。

### Task 3: 候補2「紙片のカウントダウン」を移植し、全体を検証

**Files:**
- Create: `site/src/components/motion/OpCandidate2.tsx`
- Create: `site/src/components/motion/OpCandidate2.css`
- Modify: `site/src/components/motion/OpSplash.tsx`
- Modify: `site/tests/home.spec.ts`
- Reference: 保存済み `英語を修正したらよさそう,候補2/countdown.html`、`countdown.css`、`countdown.js`

**Interfaces:**
- `OpCandidate2({ day }: { day: string })`。親から日数を受け、4秒の試作を再現する。
- 数字画像は既存の `site/public/op/countdown-digits.png` を使い、ロゴはサイト既存の素材を使う。アンマウント時に全アニメーションを `cancel()` する。

- [ ] **Step 1: 候補2固定のE2Eテストを書く** 赤・黄・青の柄、日数、ワイプ後のロゴと数字の非露出、4秒後の終了、SKIP、同じIDでの再再生を検証する。モバイル・PC両幅を対象にする。
- [ ] **Step 2: E2Eを実行してFAILを確認する** `npx playwright test tests/home.spec.ts`。
- [ ] **Step 3: 試作の演出部分を移植する** 黄色いワイプは `2850ms` 開始・`650ms` の等速移動、`3175ms` にロゴ画面へ切替。試作の操作UI・外部パス参照は除く。
- [ ] **Step 4: 対象テストと静的検査をPASSさせる** `npx playwright test tests/home.spec.ts`、`npm run check`、`npx astro check`（既存環境で利用可能なら）。必要に応じて `npm run build`。ブラウザで375px、PCの3演出・再再生・SKIPを確認する。

## Handoff

既存のOP関連ファイルとテストにはユーザーの未コミット変更がある。タスクごとに差分を確認し、その変更を消さない。レビュー完了まではコミット・push・PR作成を行わない。
