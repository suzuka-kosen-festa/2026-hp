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
 * 期待値はデータから引くので、日付が変わっても成り立つ。申込ごとに検査する
 * （申込ごとにフォームも締切も違うので、先頭の1件だけ見ていると2件目以降の
 * 取り違えを見逃す。Issue #100）。複数の企画を載せる記事（parts）は企画ごとに
 * 申込を持つので、その企画の欄の中だけを見る（ゲーム大会。Issue #102）
 */
type Day = "day1" | "day2";
type ApplicationData = { url: string; opens: string; closes?: string | null };
type LinkData = { label: string; url: string };
type FactData = { label: string; value: string };
type Section = {
  occurrences?: { day: Day }[];
  application?: ApplicationData | null;
  resources?: LinkData[];
  extraFacts?: FactData[];
};
type PartData = Section & { id: string; name: string; occurrences: { day: Day }[] };
type EntryData = Section & { id: string; parts?: PartData[] };

/**
 * 申込・資料・追加項目を持ちうる欄。記事全体の欄と、企画ごとの欄。
 * scope はその欄だけを指すセレクタ（複数の企画で同じ「申し込む」「許諾番号」が並ぶため）
 */
const sections = (entries as EntryData[]).flatMap((entry) => [
  { entryId: entry.id, name: entry.id, scope: "article.entry >", data: entry as Section },
  ...(entry.parts ?? []).map((part) => ({
    entryId: entry.id,
    name: `${entry.id}#${part.id}`,
    scope: `[data-part="${part.id}"]`,
    data: part as Section,
  })),
]);

const site = JSON.parse(readFileSync(fileURLToPath(new URL("../src/data/site.json", import.meta.url)), "utf8")) as {
  day1Date: string;
  day2Date: string;
};

const jst = (date: string, time: string) => new Date(`${date}T${time}+09:00`);
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * ボタンを閉じる瞬間。締切日があれば「締切日の日本時間 24:00」、
 * 無ければ（ゲーム大会のような定員締切）「その欄の最初の開催日の 0:00」。
 */
function closesAt(application: ApplicationData, occurrences: { day: Day }[] = []): Date {
  if (application.closes) return new Date(jst(application.closes, "00:00:00").getTime() + DAY_MS);
  const firstDay = (["day1", "day2"] as Day[]).find((day) => occurrences.some((o) => o.day === day));
  return jst(firstDay === "day2" ? site.day2Date : site.day1Date, "00:00:00");
}

for (const { entryId, name, scope, data } of sections.filter((section) => section.data.application)) {
  const application = data.application!;
  const deadline = closesAt(application, data.occurrences);

  test.describe(`entry の申込導線（${name}）`, () => {
    test("受付期間中は申込ボタンを出し、フォームを別タブで開く", async ({ page }) => {
      // 閉じる直前の1分。境界の取り違え（締切日の0時で閉じる等）をここで捕まえる
      await page.clock.setFixedTime(deadline.getTime() - 60 * 1000);
      await page.goto(`/entry/${entryId}/`);

      const apply = page.locator(`${scope} [data-apply]`);
      const button = apply.getByRole("link", { name: "申し込む" });
      await expect(button, "受付期間中なのに申込ボタンが見えません").toBeVisible();
      await expect(button).toHaveAttribute("href", application.url);
      // 外部フォームなので学祭HPを残したまま別タブで開く
      await expect(button).toHaveAttribute("target", "_blank");
      await expect(apply.getByText("募集は終了しました")).toBeHidden();
    });

    test("締切を過ぎたら申込ボタンを閉じる", async ({ page }) => {
      await page.clock.setFixedTime(deadline);
      await page.goto(`/entry/${entryId}/`);

      const apply = page.locator(`${scope} [data-apply]`);
      await expect(apply.getByText("募集は終了しました")).toBeVisible();
      await expect(apply.getByRole("link", { name: "申し込む" }), "締切後も申込ボタンが残っています").toBeHidden();
    });

    test("受付開始前は申込ボタンを出さない", async ({ page }) => {
      await page.clock.setFixedTime(jst(application.opens, "00:00:00").getTime() - 60 * 1000);
      await page.goto(`/entry/${entryId}/`);

      const apply = page.locator(`${scope} [data-apply]`);
      await expect(apply.getByText("から受付開始")).toBeVisible();
      await expect(apply.getByRole("link", { name: "申し込む" })).toBeHidden();
    });

    /* 締切日の無い募集で「〜null」「undefinedまで受付」のような表示にならないこと */
    test("募集期間の終わりを正しく書く", async ({ page }) => {
      await page.goto(`/entry/${entryId}/`, { waitUntil: "domcontentloaded" });
      const period = page.locator(`${scope} .facts .fact`, { hasText: "募集期間" });
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
for (const { entryId, name, scope, data } of sections.filter((section) => (section.data.resources ?? []).length > 0)) {
  test(`資料リンクを別タブで開く（${name}）`, async ({ page }) => {
    await page.goto(`/entry/${entryId}/`, { waitUntil: "domcontentloaded" });
    for (const resource of data.resources!) {
      const link = page.locator(`${scope} .resources a`, { hasText: resource.label });
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
for (const { entryId, name, scope, data } of sections.filter((section) => (section.data.extraFacts ?? []).length > 0)) {
  test(`追加の項目を出す（${name}）`, async ({ page }) => {
    await page.goto(`/entry/${entryId}/`, { waitUntil: "domcontentloaded" });
    for (const fact of data.extraFacts!) {
      await expect(page.locator(`${scope} .facts .fact`, { hasText: fact.label })).toContainText(fact.value);
    }
  });
}

/**
 * 複数の企画を載せる記事（Issue #102）。
 *
 * スマホでは記事が縦に長くなるので、冒頭のリンクから各企画の欄へ飛べること。
 * 開催回は企画ごとに書き、記事全体の「開催」欄は出さない（企画ごとの欄と重複するため）。
 */
const withParts = (entries as EntryData[]).filter((entry) => (entry.parts ?? []).length > 0);

for (const entry of withParts) {
  test(`企画ごとの欄へ飛べる（${entry.id}）`, async ({ page }) => {
    await page.goto(`/entry/${entry.id}/`, { waitUntil: "domcontentloaded" });

    for (const part of entry.parts!) {
      await expect(page.locator(`.parts-nav a[href="#${part.id}"]`)).toContainText(part.name);
      await expect(page.locator(`section#${part.id} h2`)).toHaveText(part.name);
      await expect(page.locator(`[data-part="${part.id}"] .facts .fact`, { hasText: "開催" })).toHaveCount(1);
    }
    await expect(page.locator("article.entry > .facts .fact", { hasText: "開催" })).toHaveCount(0);
  });
}

/**
 * 記事ページの「前の企画／次の企画」。同じ timetable のタブ × 同じステージの並びの前後をつなぐ。
 * 端の企画は行き止まりにせず、そのステージのタイムテーブルへ戻す。
 * データ（出演順）が変わっても追従するよう、表の並びを決める本番データから期待値を作らず、
 * 「前後のカードがあること」「押すと別の企画へ進むこと」「端ではタイムテーブルへ戻れること」を見る
 */
test.describe("entry の前後の企画", () => {
  test("ステージの並びの前後へ進め、端ではタイムテーブルへ戻れる", async ({ page }) => {
    await page.goto("/timetable/");
    // 1日目の LiveStage の最初の出番から始める
    const firstLive = page.locator(".tl-col-body.tl-stage-live .tl-block").first();
    const firstHref = await firstLive.getAttribute("href");
    await page.goto(firstHref!);

    const nav = page.locator("nav.neighbors").first();
    await expect(nav, "前後の企画がありません").toBeVisible();
    await expect(nav).toContainText("LiveStage");
    // 最初の出番なので「前」は無く、タイムテーブルへ戻す導線になる
    await expect(nav.locator(".neighbors-back")).toHaveAttribute("href", "/timetable/?tab=day1");

    // 「次」で2番目の出番へ進み、そこから「前」で戻ってこられる
    await nav.locator(".link-card").last().click();
    await expect(page).not.toHaveURL(new RegExp(`${firstHref}$`));
    await page.locator("nav.neighbors").first().locator(".link-card").first().click();
    await expect(page).toHaveURL(new RegExp(`${firstHref}$`));
  });

  test("ステージで行わない企画には前後の企画を出さない", async ({ page }) => {
    await page.goto("/entry/workshop-drone/");
    await expect(page.locator("nav.neighbors")).toHaveCount(0);
  });
});
