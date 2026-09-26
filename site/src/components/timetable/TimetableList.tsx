import { useEffect, useRef, useState } from "react";
import "./TimetableList.css";
import TabTagFilter, { type TabConfig } from "../filter/TabTagFilter";
import { getPermanentEntries, getScheduledSlots } from "../../lib/entries";
import { buildFilterUrl, parseFilterParams } from "../../lib/deepLink";
import { formatDayLabel } from "../../lib/eventDate";
import { isOccurrenceNow } from "../../lib/now";
import type { Day, Entry } from "../../types/content";

interface Props {
  entries: Entry[];
}

const STAGES = ["MainStage", "LiveStage", "SubStage"] as const;
type Stage = (typeof STAGES)[number];

/**
 * timetableに載せるのはこの3ステージの企画だけ（requirements.md §3.5）。
 * 時刻を持っていてもステージ以外で開催する企画（ワークショップ等）は、
 * ここで**意図的に**落としている。バグではないので、載っていない企画を見つけても
 * このフィルタを緩めないこと。会場内の特定ステージに紐づかない企画は、
 * トップのpickupやnewsで扱う方針。
 */
function isKnownStage(location: string | null): location is Stage {
  return (STAGES as readonly string[]).includes(location ?? "");
}

const DAYS: Day[] = ["day1", "day2"];
const TABS: TabConfig[] = DAYS.map((day) => ({ id: day, label: formatDayLabel(day) }));

const DESKTOP_QUERY = "(min-width: 900px)";
const PX_PER_HOUR_SP = 140;
const PX_PER_HOUR_PC = 170;
const AXIS_MIN_START = 9 * 60;
/**
 * 日ごとの軸の終わり。1日目は15:00以降が中夜祭（timetableの対象外）なので15:00で切る。
 * これより遅く終わる企画がデータに入った場合は、切れないよう軸のほうを延ばす。
 */
const AXIS_END: Record<Day, number> = { day1: 15 * 60, day2: 16 * 60 };
const SAFETY_MIN_HEIGHT_SP = 36;
const SAFETY_MIN_HEIGHT_PC = 46;
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatHourLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:00`;
}

/**
 * グリッドの枠は狭いので「グランプリ」は「GP」に縮めて出す（Vocal1グランプリ → Vocal1GP）。
 * データ側はグランプリ表記のまま持ち、詳細ページのタイトルやtitle属性は正式名で出す。
 */
function gridName(name: string): string {
  return name.replaceAll("グランプリ", "GP");
}

export default function TimetableList({ entries }: Props) {
  const [activeDay, setActiveDay] = useState<Day>(DAYS[0]);
  const [isDesktop, setIsDesktop] = useState(false);
  const isFirstSync = useRef(true);

  useEffect(() => {
    const { tab } = parseFilterParams(window.location.search);
    if (tab && DAYS.includes(tab as Day)) setActiveDay(tab as Day);
  }, []);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const PX_PER_HOUR = isDesktop ? PX_PER_HOUR_PC : PX_PER_HOUR_SP;
  const PX_PER_MINUTE = PX_PER_HOUR / 60;
  const SAFETY_MIN_HEIGHT = isDesktop ? SAFETY_MIN_HEIGHT_PC : SAFETY_MIN_HEIGHT_SP;

  useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return;
    }
    const url = buildFilterUrl("/timetable/", { tab: activeDay });
    window.history.replaceState(null, "", url);
  }, [activeDay]);

  const permanentEntries = getPermanentEntries(entries);
  const slots = getScheduledSlots(entries, activeDay).filter((slot) => isKnownStage(slot.entry.location));

  const starts = slots.map((slot) => toMinutes(slot.occurrence.start_time as string));
  const ends = slots.map((slot) => toMinutes(slot.occurrence.end_time as string));
  const axisStart = starts.length > 0 ? Math.min(AXIS_MIN_START, Math.floor(Math.min(...starts) / 60) * 60) : AXIS_MIN_START;
  const axisEnd = ends.length > 0 ? Math.max(AXIS_END[activeDay], Math.ceil(Math.max(...ends) / 60) * 60) : AXIS_END[activeDay];

  const hourMarks: number[] = [];
  for (let t = axisStart; t <= axisEnd; t += 60) hourMarks.push(t);

  const yFor = (minutes: number) => (minutes - axisStart) * PX_PER_MINUTE;
  const CARD_GAP = 5;
  const columns = STAGES.map((stage) => {
    let prevBottom = -Infinity;
    const blocks = slots
      .filter((slot) => slot.entry.location === stage)
      .map((slot) => {
        const start = toMinutes(slot.occurrence.start_time as string);
        const end = toMinutes(slot.occurrence.end_time as string);
        const naturalTop = yFor(start);
        const height = Math.max(yFor(end) - naturalTop - CARD_GAP, SAFETY_MIN_HEIGHT);
        const top = Math.max(naturalTop, prevBottom);
        prevBottom = top + height + CARD_GAP;
        return { slot, top, height };
      });

    // 短い枠は最小の高さで下へ押し出されるので、そのままだと終盤の枠が軸の終わりからはみ出す
    // （2日目のフィナーレ→エンディング等）。後ろから詰め直して軸の終わりに収める。
    // 余裕のある長い枠（メモリーズ等）を見た目だけ縮めて吸収し、それでも足りなければ短い枠を少し上げる。
    // 枠に書く時刻は実際の時刻のままなので、ずれるのは位置だけ。
    let limit = yFor(axisEnd);
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      if (block.top + block.height > limit) {
        block.height = Math.max(limit - block.top, SAFETY_MIN_HEIGHT);
        block.top = Math.min(block.top, limit - block.height);
      }
      limit = block.top - CARD_GAP;
    }
    return { stage, blocks };
  });
  const totalHeight = yFor(axisEnd);

  return (
    <div className="timetable-list" id="list">
      {permanentEntries.length > 0 && (
        <div className="tl-permanent">
          <h2 className="tl-permanent-title">常設</h2>
          <ul className="tl-permanent-list">
            {permanentEntries.map((entry) => (
              <li key={entry.id} className="tl-permanent-card">
                <div className="tl-permanent-photo">
                  {entry.image ? (
                    <img src={entry.image} alt="" loading="lazy" />
                  ) : (
                    <span className="tl-no-image num">NO IMAGE</span>
                  )}
                </div>
                <div className="tl-permanent-body">
                  <a className="tl-permanent-link" href={`/entry/${entry.id}/`}>
                    <p className="tl-permanent-name">{entry.name}</p>
                    {entry.summary && <p className="tl-permanent-summary">{entry.summary}</p>}
                  </a>
                  {entry.link && (
                    <a className="tl-permanent-cta" href={entry.link}>
                      やってみる →
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <TabTagFilter
        tabs={TABS}
        activeTab={activeDay}
        onTabChange={(day) => setActiveDay(day as Day)}
        selectedTags={[]}
        onTagsChange={() => {}}
      />

      <div className="tl-grid-wrap">
        <div className="tl-grid">
          <div className="tl-corner" aria-hidden="true" />
          {STAGES.map((stage) => (
            <div key={stage} className={`tl-col-header tl-stage-${stage}`}>
              {stage}
            </div>
          ))}

          <div className="tl-axis-body" style={{ height: `${totalHeight}px` }}>
            {hourMarks.map((t) => (
              <span key={t} className="tl-hour-label num" style={{ top: `${yFor(t)}px` }}>
                {formatHourLabel(t)}
              </span>
            ))}
          </div>

          {columns.map(({ stage, blocks }) => (
            <div key={stage} className={`tl-col-body tl-stage-${stage}`} style={{ height: `${totalHeight}px` }}>
              {hourMarks.map((t) => (
                <div key={t} className="tl-hour-line" style={{ top: `${yFor(t)}px` }} />
              ))}
              {blocks.map(({ slot: { entry, occurrence }, top, height }, i) => (
                <a
                  key={`${entry.id}-${occurrence.day}-${occurrence.start_time}-${i}`}
                  className="tl-block"
                  style={{ top: `${top}px`, height: `${height}px` }}
                  href={`/entry/${entry.id}/`}
                  title={entry.name}
                >
                  <span className="tl-block-time num">
                    {occurrence.start_time}
                    <span className="tl-time-sep">-</span>
                    {occurrence.end_time}
                  </span>
                  <span className="tl-block-name">
                    {gridName(entry.name)}
                    {isOccurrenceNow(occurrence) && <span className="tl-now">NOW</span>}
                  </span>
                </a>
              ))}
            </div>
          ))}
        </div>

        {slots.length === 0 && <p className="tl-empty">この日程の該当企画はまだありません</p>}
      </div>
    </div>
  );
}
