import layout from "../../data/map-indoor.json";
import { indoor, mapEntry } from "./model";

// 教室の並び・結合はExcel、棟の向きと表示範囲はFigma。
// セルの大きさは距離を意味しない。廊下を細くした、縮尺なしの配置図。
const cell = (address: string) => {
  const match = /^([A-Z]+)(\d+)$/.exec(address)!;
  let column = 0;
  for (const letter of match[1]) column = column * 26 + letter.charCodeAt(0) - 64;
  return { column, row: Number(match[2]) };
};
export const indoorBuildings = layout.floors.map((building) => {
  const [x, y, width, height] = building.bounds;
  const isI = building.building === "I科棟";
  const endColumn = isI ? 12 : 13;
  const columnWidths = Array.from({ length: endColumn - 1 }, (_, index) => isI && index + 2 === 4 ? 7.63 : 12.63);
  const total = columnWidths.reduce((sum, value) => sum + value, 0);
  const columnPosition = (column: number) => columnWidths.slice(0, column - 2).reduce((sum, value) => sum + value, 0) / total;
  const rowPosition = (row: number) => row <= building.sourceRows[0] ? 0 : row >= building.sourceRows[1] + 1 ? 1 : row === building.sourceRows[1] ? .57 : .43;
  const rooms = building.rooms.map((room) => {
    const [startAddress, endAddress = startAddress] = room.range.split(":");
    const start = cell(startAddress), end = cell(endAddress);
    const left = columnPosition(start.column), right = columnPosition(end.column + 1);
    const top = rowPosition(start.row), bottom = rowPosition(end.row + 1);
    // I科棟はFigmaの縦向き。Excelの横長図を反時計回りに対応づける。
    const bounds = isI ? [x + top * width, y + (1 - right) * height, (bottom - top) * width, (right - left) * height]
      : [x + left * width, y + top * height, (right - left) * width, (bottom - top) * height];
    const key = `${building.building.startsWith("C") ? "C" : "I"}:${building.floor}:${room.room}`;
    const listId = `room-${isI ? "I" : "C"}-${building.floor}-${room.range.replace(":", "-")}`;
    // 正本の運営情報は保持し、来場者向け表示に必要な用途だけを取り出す。
    const note = room.note.split("・").filter((text) => !/控室|一時避難場所|全体マップの05/.test(text)).join("・");
    return { ...room, note, key, listId, bounds, entries: room.entryIds.map((id) => ({ entryId: id, entry: mapEntry(id) })) };
  });
  return { ...building, rooms };
});
const placedIds = new Set(indoorBuildings.flatMap((building) => building.rooms.flatMap((room) => room.entryIds)));
export const unplacedIndoor = indoor.filter((venue) => !placedIds.has(venue.entryId));
export { layout as indoorLayout };
