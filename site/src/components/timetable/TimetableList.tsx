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

const KNOWN_STAGES = ["LiveStage", "MainStage", "SubStage"] as const;
type StageGroup = (typeof KNOWN_STAGES)[number] | "その他";
const STAGE_ORDER: StageGroup[] = [...KNOWN_STAGES, "その他"];

function stageGroupOf(location: string | null): StageGroup {
  return (KNOWN_STAGES as readonly string[]).includes(location ?? "") ? (location as StageGroup) : "その他";
}

const STAGE_TAGS = STAGE_ORDER.map((stage) => ({ id: stage, label: stage }));

const DAYS: Day[] = ["day1", "day2"];
const TABS: TabConfig[] = DAYS.map((day) => ({ id: day, label: formatDayLabel(day), tags: STAGE_TAGS }));

export default function TimetableList({ entries }: Props) {
  const [activeDay, setActiveDay] = useState<Day>(DAYS[0]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const isFirstSync = useRef(true);

  // マウント後にURL(?tab=&tags=)から初期状態を復元する。
  useEffect(() => {
    const { tab, tags } = parseFilterParams(window.location.search);
    if (tab && DAYS.includes(tab as Day)) setActiveDay(tab as Day);
    if (tags.length > 0) setSelectedTags(tags);
  }, []);

  // 日タブ・タグの選択をURLに反映する
  useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return;
    }
    const url = buildFilterUrl("/timetable/", { tab: activeDay, tags: selectedTags });
    window.history.replaceState(null, "", url);
  }, [activeDay, selectedTags]);

  const permanentEntries = getPermanentEntries(entries);
  const slots = getScheduledSlots(entries, activeDay);
  const filtered =
    selectedTags.length === 0 ? slots : slots.filter((slot) => selectedTags.includes(stageGroupOf(slot.entry.location)));
  const grouped = STAGE_ORDER.map((stage) => ({
    stage,
    slots: filtered.filter((slot) => stageGroupOf(slot.entry.location) === stage),
  })).filter((group) => group.slots.length > 0);

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
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
      />

      <div className="tl-schedule">
        {grouped.length === 0 && <p className="tl-empty">該当する企画がありません</p>}
        {grouped.map((group) => (
          <section key={group.stage} id={group.stage} className="tl-stage">
            <h2 className="tl-stage-title">{group.stage}</h2>
            <ul className="tl-rows">
              {group.slots.map(({ entry, occurrence }, i) => (
                <li key={`${entry.id}-${occurrence.day}-${occurrence.start_time}-${i}`}>
                  <a className="tl-row-link" href={`/entry/${entry.id}/`}>
                    <div className="tl-time num">
                      {occurrence.start_time}
                      <span className="tl-time-sep">-</span>
                      {occurrence.end_time}
                    </div>
                    <div className="tl-row-body">
                      <p className="tl-name">
                        {entry.name}
                        {isOccurrenceNow(occurrence) && <span className="tl-now">NOW</span>}
                      </p>
                      {entry.group && <p className="tl-group">{entry.group}</p>}
                      {group.stage === "その他" && entry.location && <p className="tl-location">{entry.location}</p>}
                      {occurrence.note && <p className="tl-note">※{occurrence.note}</p>}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
