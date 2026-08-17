import { useEffect, useRef, useState } from "react";
import "./BoothList.css";
import TabTagFilter, { type TabConfig } from "../filter/TabTagFilter";
import { getByCategory, getPermanentEntries } from "../../lib/entries";
import { buildFilterUrl, parseFilterParams } from "../../lib/deepLink";
import { dayColorClass, formatDayLabel } from "../../lib/eventDate";
import type { Category, Day, Entry, Occurrence } from "../../types/content";

interface Props {
  entries: Entry[];
}

function formatOccurrenceTimes(occurrences: Occurrence[]) {
  const order: Day[] = ["day1", "day2"];
  return order
    .map((day) => {
      const items = occurrences.filter((o) => o.day === day && o.start_time);
      if (items.length === 0) return null;
      const times = items.map((o) => (o.end_time ? `${o.start_time}-${o.end_time}` : `${o.start_time}〜`)).join("・");
      return { day, times };
    })
    .filter((g): g is { day: Day; times: string } => g !== null);
}

// タブ・タグの定義。タブごとのタグセットに対応
const TABS: TabConfig[] = [
  {
    id: "出店",
    label: "出店",
    tags: [
      { id: "飲食-フード", label: "飲食-フード" },
      { id: "飲食-スイーツ", label: "飲食-スイーツ" },
      { id: "レク", label: "レク" },
      { id: "物販", label: "物販" },
      { id: "展示", label: "展示" },
    ],
  },
  {
    id: "学科展示",
    label: "学科展示",
    tags: [
      { id: "M科", label: "M科" },
      { id: "E科", label: "E科" },
      { id: "I科", label: "I科" },
      { id: "C科", label: "C科" },
      { id: "S科", label: "S科" },
    ],
  },
  {
    id: "イベント",
    label: "イベント",
    tags: [
      { id: "day1", label: formatDayLabel("day1") },
      { id: "day2", label: formatDayLabel("day2") },
    ],
  },
  {
    id: "ライブ",
    label: "ライブ",
    tags: [
      { id: "day1", label: formatDayLabel("day1") },
      { id: "day2", label: formatDayLabel("day2") },
      { id: "中夜祭", label: "中夜祭" },
      { id: "決勝バンド", label: "決勝バンド" },
    ],
  },
];

export default function BoothList({ entries }: Props) {
  const [activeTab, setActiveTab] = useState<string>(TABS[0].id);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const isFirstSync = useRef(true);

  // マウント後にURL(?tab=&tags=)から初期状態を復元する。
  useEffect(() => {
    const { tab, tags } = parseFilterParams(window.location.search);
    if (tab && TABS.some((t) => t.id === tab)) setActiveTab(tab);
    if (tags.length > 0) setSelectedTags(tags);
  }, []);

  // タブ・タグの選択をURLに反映する
  useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return;
    }
    const url = buildFilterUrl("/booth/", { tab: activeTab, tags: selectedTags });
    window.history.replaceState(null, "", url);
  }, [activeTab, selectedTags]);

  const tabEntries = getByCategory(entries, activeTab as Category);
  const permanentEntries = getPermanentEntries(entries)
    .slice()
    .sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
  const regularEntries = tabEntries.filter((entry) => !entry.isPermanent);
  const filtered =
    selectedTags.length === 0
      ? regularEntries
      : regularEntries.filter((entry) => entry.tags.some((tag) => selectedTags.includes(tag)));

  return (
    <div className="booth-list" id="list">
      {permanentEntries.length > 0 && (
        <div className="bl-permanent">
          <h2 className="bl-permanent-title">常設</h2>
          <ul className="bl-permanent-list">
            {permanentEntries.map((entry) => (
              <li key={entry.id} className="bl-permanent-card">
                <div className="bl-permanent-photo">
                  {entry.image ? (
                    <img src={entry.image} alt="" loading="lazy" />
                  ) : (
                    <span className="bl-no-image num">NO IMAGE</span>
                  )}
                </div>
                <div className="bl-permanent-body">
                  <a className="bl-permanent-link" href={`/entry/${entry.id}/`}>
                    <p className="bl-permanent-name">{entry.name}</p>
                    {entry.summary && <p className="bl-permanent-summary">{entry.summary}</p>}
                  </a>
                  {entry.link && (
                    <a className="bl-permanent-cta" href={entry.link}>
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
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
      />

      <ul className="bl-grid">
        {filtered.map((entry, i) => (
          <li key={entry.id}>
            <a className="bl-card-link" href={`/entry/${entry.id}/`}>
              <div className="bl-card" style={{ transform: `rotate(${i % 2 === 0 ? -0.8 : 0.9}deg)` }}>
                <div className="bl-photo">
                  {entry.image ? (
                    <img src={entry.image} alt="" loading="lazy" />
                  ) : (
                    <span className="bl-no-image num">NO IMAGE</span>
                  )}
                </div>
                <div className="bl-body">
                  <p className="bl-name">{entry.name}</p>
                  {entry.group && <p className="bl-group">{entry.group}</p>}
                  {entry.summary && <p className="bl-summary">{entry.summary}</p>}
                  {entry.tags.length > 0 && (
                    <ul className="bl-tags">
                      {entry.tags.map((tag, ti) => (
                        <li key={tag}>
                          <span className={`bl-chip ${ti % 2 === 0 ? "red" : "blue"}`}>{tag}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {entry.occurrences.length > 0 && (
                    <ul className="bl-times">
                      {formatOccurrenceTimes(entry.occurrences).map((g) => (
                        <li key={g.day}>
                          <span className={`bl-day num ${dayColorClass(g.day) ?? ""}`}>{formatDayLabel(g.day)}</span>
                          <span className="bl-time num">{g.times}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {entry.location && <p className="bl-location">{entry.location}</p>}
                  <span className="bl-more">view more →</span>
                </div>
              </div>
            </a>
          </li>
        ))}
        {filtered.length === 0 && <li className="bl-empty">該当する企画がありません</li>}
      </ul>
    </div>
  );
}
