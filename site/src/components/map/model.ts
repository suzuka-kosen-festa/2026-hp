import data from "../../data/map.json";
import { entries } from "../../lib/loadEntries";
import booth from "../../data/entries/booth.json";
import department from "../../data/entries/department.json";
import program from "../../data/entries/program.json";
import { buildFilterUrl } from "../../lib/deepLink";
import { isComingSoon } from "../../lib/release";
const byId = new Map(entries.map((entry) => [entry.id, entry]));
const excluded = new Set(data.excludedEntryIds);
// hidden の企画は entries から落ちている。MAPの配置データは消さずに残し、非公開の間だけ案内から外す（hidden を外せば自動で戻る）。
const hiddenIds = new Set(([...booth, ...department, ...program] as { id: string; hidden?: boolean }[]).filter((entry) => entry.hidden).map((entry) => entry.id));
export const isHiddenEntry = (id: string) => hiddenIds.has(id);
export function mapEntry(id: string) {
  const entry = byId.get(id);
  if (!entry || excluded.has(id)) throw new Error(`MAP: 掲載企画IDを確認してください: ${id}`);
  return {
    ...entry,
    name: (data.nameOverrides as Record<string, string>)[id] ?? entry.name,
    group: (data.groupOverrides as Record<string, string>)[id] ?? entry.group,
  };
}
export const areas = data.areas.map((area) => {
  const href = area.entryId === "game-tournament" ? "/map/game/"
    : area.entryId ? `/entry/${area.entryId}/`
    : area.key === "department" ? buildFilterUrl("/booth/", { tab: "学科展示", scrollTo: "list" })
    : area.key === "food-bazaar" ? "/map/food/" : "/map/exhibition/";
  const actionLabel = area.entryId === "game-tournament" ? "教室の場所とゲーム詳細を見る" : area.entryId ? "ゲーム大会の詳細を見る"
    : area.key === "department" ? "学科展示を見る" : area.key === "food-bazaar" ? "店舗と番号を見る" : "棟・階の案内を見る";
  // MAP内の案内ページは全体MAPと同じ公開状態になるので、準備中の判定はMAP外の行き先だけに掛ける。
  return { ...area, href, actionLabel, comingSoon: (area.entryId ? isHiddenEntry(area.entryId) : false) || (!href.startsWith("/map/") && isComingSoon(href.split(/[?#]/)[0])) };
});
// ステージは番号を振らず、絵に名札を重ねる。名札からタイムテーブルの該当ステージへ進める（日付タブは当日に合わせてブラウザで差し替える）。
export const stages = data.stages.map((stage) => ({ ...stage,
  href: buildFilterUrl("/timetable/", { tab: "day1", scrollTo: `stage-${stage.name}` }),
  comingSoon: isComingSoon("/timetable/") }));
// 全素材に同じ原点を使い、書き出しに含まれる回転を二重に掛けない。
// view は表示する範囲 [x, y, 幅, 高さ]。省略時は会場全体。飲食バザーの図は同じ座標で一部だけを切り出す。
type View = readonly number[];
const wholeView: View = [0, 0, data.size[0], data.size[1]];
export const placementStyle = (b: number[], v: View = wholeView) => `left:${(b[0] - v[0]) / v[2] * 100}%;top:${(b[1] - v[1]) / v[3] * 100}%;width:${b[2] / v[2] * 100}%;height:${b[3] / v[3] * 100}%`;
export const anchorStyle = (b: number[], v: View = wholeView) => `--x:${(b[0] + b[2] / 2 - v[0]) / v[2] * 100}%;--y:${(b[1] + b[3] / 2 - v[1]) / v[3] * 100}%`;
export const venues = data.venues.map((venue) => ({ ...venue, href: `/map/${venue.key}/` }));
export const areaByKey = (key: string) => areas.find((area) => area.key === key)!;
export const stalls = data.stalls.map((slot) => ({ ...slot, entry: mapEntry(slot.entryId), group: slot.key.split(":")[0], code: slot.key.split(":")[1] }));
export const indoor = data.indoor.filter((venue) => !isHiddenEntry(venue.entryId)).map((venue) => ({ ...venue, entry: mapEntry(venue.entryId) }));
export { data };
