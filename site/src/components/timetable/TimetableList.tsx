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

function isKnownStage(location: string | null): location is Stage {
  return (STAGES as readonly string[]).includes(location ?? "");
}

const DAYS: Day[] = ["day1", "day2"];
const TABS: TabConfig[] = DAYS.map((day) => ({ id: day, label: formatDayLabel(day) }));

const DESKTOP_QUERY = "(min-width: 900px)";
const PX_PER_HOUR_SP = 280;
const PX_PER_HOUR_PC = 340;
const AXIS_MIN_START = 9 * 60;
const AXIS_MAX_END = 17 * 60;
// カードの最低保証高さ。時刻(1行)+企画名(最大2行)+padding+gapの実測合計を上回る値にする
// (出演者/主催者名の表示をやめたぶん、以前より必要な高さが減っている)。
const SAFETY_MIN_HEIGHT_SP = 50;
const SAFETY_MIN_HEIGHT_PC = 60;

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatHourLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:00`;
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
  const axisEnd = ends.length > 0 ? Math.max(AXIS_MAX_END, Math.ceil(Math.max(...ends) / 60) * 60) : AXIS_MAX_END;

  const hourMarks: number[] = [];
  for (let t = axisStart; t <= axisEnd; t += 60) hourMarks.push(t);

  const yFor = (minutes: number) => (minutes - axisStart) * PX_PER_MINUTE;
  const totalHeight = yFor(axisEnd);

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
    return { stage, blocks };
  });

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
            <div key={stage} className="tl-col-header">
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
            <div key={stage} className="tl-col-body" style={{ height: `${totalHeight}px` }}>
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
                    {entry.name}
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
