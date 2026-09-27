import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { describePage, showsContent } from "./_shared";

// 開催回・対象・定員・注記を全部持つ、いま一番情報量の多いエントリ
describePage("entry", "/entry/workshop-ai-sorting-robot/");

/**
 * 写真を用意できない企画は今後も存在するので、画像なしを正式なレイアウトとして扱う。
 * 16:9の「NO IMAGE」枠を出すと、その高さぶんがまるごと無駄になる（Issue #56）。
 * 実データが入って画像の有無が変わっても追従するよう、データから引いて検査する。
 */
const entriesDir = new URL("../src/data/entries/", import.meta.url);
const entries: { id: string; image?: string; categoryLabel?: string }[] = ["booth", "department", "program"].flatMap((name) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`${name}.json`, entriesDir)), "utf8")),
);

const withoutImage = entries.find((entry) => !entry.image);
const withImage = entries.find((entry) => entry.image);

/**
 * 画像ありも画像なしも見つからないと両方の describe が skip になり、
 * 「常に緑だが何も検査していない」状態になる。データ側が空になったことに
 * 気づけるよう、ここで明示的に落とす。
 */
test("画像まわりを検査できるデータがある", () => {
  expect(
    withoutImage ?? withImage,
    "entries が空です。画像まわりの検査が1件も走っていません",
  ).toBeTruthy();
});

test.describe("entry の画像", () => {
  test.skip(!withoutImage, "画像なしのエントリが無いため");

  test("画像が無い企画は写真枠ごと出さない", async ({ page }) => {
    await page.goto(`/entry/${withoutImage!.id}/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".photo"), "画像が無いのに写真枠が残っています").toHaveCount(0);
    await expect(page.getByText("NO IMAGE"), "NO IMAGE のプレースホルダが出ています").toHaveCount(0);
    // 中身が消えていないことも見る（枠を消しすぎていないか）
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("entry の画像（あり）", () => {
  test.skip(!withImage, "画像ありのエントリがまだ無いため");

  test("画像がある企画は今までどおり写真枠を出す", async ({ page }) => {
    await page.goto(`/entry/${withImage!.id}/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".photo img")).toHaveCount(1);
  });
});

/**
 * 戻る導線（MTG 2026-09-06）。
 *
 * 以前は「← 企画一覧へ」で /booth/ に決め打ちだった。v1では /booth/ が準備中なので、
 * トップのPICK UPから入った人が戻ろうとすると準備中ページに着地していた。
 *
 * サイト内から来たときは履歴で元のページへ、履歴が無いとき（検索やQRからの
 * 直接着地）はトップへ。JSが動かなくても href="/" の普通のリンクとして機能する。
 */
test.describe("entry の戻る導線", () => {
  test("直接来たときはトップへ戻る", async ({ page }) => {
    await page.goto("/entry/workshop-ai-sorting-robot/");

    const back = page.locator("a[data-back]");
    await expect(back, "戻るリンクがありません").toHaveCount(1);
    // JS無効でも機能するよう、href は常にトップを指しておく
    await expect(back).toHaveAttribute("href", "/");

    await back.click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("サイト内から来たときは元のページへ戻る", async ({ page }) => {
    /* 一覧が準備中だとカードが無く、たどれない。published に足せば検査に戻る */
    test.skip(!showsContent("/booth/"), "/booth/ が準備中のため");

    await page.goto("/booth/");
    await page.locator('a[href^="/entry/"]').first().click();
    await expect(page).toHaveURL(/\/entry\//);

    await page.locator("a[data-back]").click();
    await expect(page, "元いた一覧ではなくトップに戻っています").toHaveURL(/\/booth\/$/);
  });
});

/**
 * 表示用のカテゴリ名（MTG 2026-09-06）。
 *
 * ワークショップは青いテープに「イベント」と出ていた。`category` は booth の
 * 絞り込みタブとタイムテーブル掲載を決めているので表示の都合で書き換えられず、
 * `categoryLabel` で表示だけを差し替えている。
 *
 * 期待値はデータから引くので、他の企画に付けても成り立つ。
 */
const withLabel = entries.filter((entry) => (entry as { categoryLabel?: string }).categoryLabel);

test.describe("表示用のカテゴリ名", () => {
  test.skip(withLabel.length === 0, "categoryLabel を持つ企画が無いため");

  test("categoryLabel があればそれを出す", async ({ page }) => {
    for (const entry of withLabel) {
      const label = (entry as { categoryLabel?: string }).categoryLabel!;
      await page.goto(`/entry/${entry.id}/`, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".cat"), `${entry.id} のカテゴリ表示`).toHaveText(label);
    }
  });
});

/**
 * 事前申込の導線（Issue #96）。
 *
 * 静的サイトなので、ビルド時刻だけでボタンを出し分けると、締切後も再デプロイ
 * されるまで応募フォームへ誘導し続ける。閲覧時の時刻で合わせ直していることを、
 * ブラウザの時計を締切の前後にずらして確かめる。
 *
 * 締切の境界は「締切日の日本時間 24:00」。期待値はデータから引くので、
 * 日付が変わっても成り立つ。申込を持つ企画ごとに検査する（企画ごとにフォームも
 * 締切も違うので、先頭の1件だけ見ていると2件目以降の取り違えを見逃す。Issue #100）
 */
type ApplicationEntry = (typeof entries)[number] & {
  application: { url: string; opens: string; closes?: string | null };
  occurrences: { day: "day1" | "day2" }[];
};
const withApplication = entries.filter(
  (entry) => (entry as { application?: unknown }).application,
) as ApplicationEntry[];

const site = JSON.parse(readFileSync(fileURLToPath(new URL("../src/data/site.json", import.meta.url)), "utf8")) as {
  day1Date: string;
  day2Date: string;
};

const jst = (date: string, time: string) => new Date(`${date}T${time}+09:00`);
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * ボタンを閉じる瞬間。締切日があれば「締切日の日本時間 24:00」、
 * 無ければ（ゲーム大会のような定員締切）「最初の開催日の 0:00」。
 */
function closesAt({ application, occurrences }: ApplicationEntry): Date {
  if (application.closes) return new Date(jst(application.closes, "00:00:00").getTime() + DAY_MS);
  const firstDay = ["day1", "day2"].find((day) => occurrences.some((o) => o.day === day)) as "day1" | "day2";
  return jst(firstDay === "day1" ? site.day1Date : site.day2Date, "00:00:00");
}

for (const entry of withApplication) {
  const { id, application } = entry;
  test.describe(`entry の申込導線（${id}）`, () => {
    test("受付期間中は申込ボタンを出し、フォームを別タブで開く", async ({ page }) => {
      // 閉じる直前の1分。境界の取り違え（締切日の0時で閉じる等）をここで捕まえる
      await page.clock.setFixedTime(closesAt(entry).getTime() - 60 * 1000);
      await page.goto(`/entry/${id}/`);

      const button = page.getByRole("link", { name: "申し込む" });
      await expect(button, "受付期間中なのに申込ボタンが見えません").toBeVisible();
      await expect(button).toHaveAttribute("href", application.url);
      // 外部フォームなので学祭HPを残したまま別タブで開く
      await expect(button).toHaveAttribute("target", "_blank");
      await expect(page.getByText("募集は終了しました")).toBeHidden();
    });

    test("締切を過ぎたら申込ボタンを閉じる", async ({ page }) => {
      await page.clock.setFixedTime(closesAt(entry));
      await page.goto(`/entry/${id}/`);

      await expect(page.getByText("募集は終了しました")).toBeVisible();
      await expect(page.getByRole("link", { name: "申し込む" }), "締切後も申込ボタンが残っています").toBeHidden();
    });

    test("受付開始前は申込ボタンを出さない", async ({ page }) => {
      await page.clock.setFixedTime(jst(application.opens, "00:00:00").getTime() - 60 * 1000);
      await page.goto(`/entry/${id}/`);

      await expect(page.getByText("から受付開始")).toBeVisible();
      await expect(page.getByRole("link", { name: "申し込む" })).toBeHidden();
    });

    /* 締切日の無い募集で「〜null」「undefinedまで受付」のような表示にならないこと */
    test("募集期間の終わりを正しく書く", async ({ page }) => {
      await page.goto(`/entry/${id}/`, { waitUntil: "domcontentloaded" });
      const period = page.locator(".fact", { hasText: "募集期間" });
      await expect(period).not.toContainText(/null|undefined|NaN/);
      if (!application.closes) await expect(period).toContainText("定員に達し次第締切");
    });
  });
}

/**
 * 資料リンク（参加者規約・大会ポスターなど）。
 *
 * サイト内に置いたポスター画像はファイル名の書き間違いでリンク切れになりうるので、
 * 実際に取れることまで見る。外部リンクは相手の都合で落ちるので、ここでは叩かない。
 */
const withResources = entries.filter(
  (entry) => ((entry as { resources?: unknown[] }).resources ?? []).length > 0,
) as ((typeof entries)[number] & { resources: { label: string; url: string }[] })[];

for (const { id, resources } of withResources) {
  test(`資料リンクを別タブで開く（${id}）`, async ({ page }) => {
    await page.goto(`/entry/${id}/`, { waitUntil: "domcontentloaded" });
    for (const resource of resources) {
      const link = page.locator(".resources a", { hasText: resource.label });
      await expect(link, `${resource.label} のリンクがありません`).toHaveAttribute("href", resource.url);
      await expect(link).toHaveAttribute("target", "_blank");
      if (resource.url.startsWith("/")) {
        const response = await page.request.get(resource.url);
        expect(response.ok(), `${resource.url} が取得できません`).toBeTruthy();
      }
    }
  });
}

/**
 * 追加の項目（大会許諾番号など）。任天堂のガイドラインで告知への記載が求められる
 * ものなので、注意書きに埋もれず項目として出ていることを見る。
 */
const withExtraFacts = entries.filter(
  (entry) => ((entry as { extraFacts?: unknown[] }).extraFacts ?? []).length > 0,
) as ((typeof entries)[number] & { extraFacts: { label: string; value: string }[] })[];

for (const { id, extraFacts } of withExtraFacts) {
  test(`追加の項目を出す（${id}）`, async ({ page }) => {
    await page.goto(`/entry/${id}/`, { waitUntil: "domcontentloaded" });
    for (const fact of extraFacts) {
      await expect(page.locator(".fact", { hasText: fact.label })).toContainText(fact.value);
    }
  });
}
