import { useEffect, useRef, useState } from "react";
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
      { id: "day1", label: "day1" },
      { id: "day2", label: "day2" },
    ],
  },
  {
    id: "ライブ",
    label: "ライブ",
    tags: [
      { id: "day1", label: "day1" },
      { id: "day2", label: "day2" },
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
  const permanentEntries = getPermanentEntries(entries);
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
                    {(entry.summary ?? entry.description) && (
                      <p className="bl-permanent-summary">{entry.summary ?? entry.description}</p>
                    )}
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

      <style>{`
        .booth-list {
          margin-top: 20px;
        }
        .bl-grid {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-top: 20px;
        }
        .bl-empty {
          font-size: 13px;
          color: #666;
          padding: 24px 0;
          text-align: center;
        }
        .bl-permanent {
          margin-top: 20px;
          margin-bottom: 20px;
        }
        .bl-permanent-title {
          display: inline-block;
          font-size: 12px;
          font-weight: 800;
          color: #fff;
          background: var(--yellow);
          padding: 3px 12px;
          margin-bottom: 10px;
        }
        .bl-permanent-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .bl-permanent-card {
          display: flex;
          background: #fff;
          border: 2px solid var(--ink);
          box-shadow: 5px 5px 0 var(--ink);
          overflow: hidden;
        }
        .bl-permanent-photo {
          position: relative;
          display: flex;
          flex: 0 0 110px;
          align-items: center;
          justify-content: center;
          background: #f3ebd9;
          border-right: 2px solid var(--ink);
        }
        .bl-permanent-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .bl-permanent-body {
          flex: 1;
          min-width: 0;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
        .bl-permanent-link {
          display: block;
        }
        .bl-permanent-name {
          font-weight: 800;
          font-size: 15px;
        }
        .bl-permanent-summary {
          font-size: 12.5px;
          line-height: 1.6;
          margin-top: 4px;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          line-clamp: 2;
          overflow: hidden;
        }
        .bl-permanent-cta {
          position: relative;
          z-index: 0;
          display: inline-block;
          color: var(--ink);
          font-weight: 800;
          font-size: 12.5px;
          padding: 8px 18px;
        }
        .bl-permanent-cta::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          background: var(--yellow);
          filter: url(#tape-edge);
        }
        .bl-card-link {
          display: block;
        }
        .bl-card {
          position: relative;
          background: #fff;
          border: 2px solid var(--ink);
          box-shadow: 5px 5px 0 var(--ink);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .bl-photo {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          aspect-ratio: 16 / 9;
          background: #f3ebd9;
          border-bottom: 2px solid var(--ink);
        }
        .bl-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .bl-no-image {
          font-size: 12px;
          letter-spacing: 0.05em;
          color: #999;
        }
        .bl-body {
          padding: 14px 16px 16px;
        }
        .bl-name {
          font-weight: 800;
          font-size: 15.5px;
        }
        .bl-group {
          font-size: 12.5px;
          color: var(--blue);
          margin-top: 4px;
        }
        .bl-summary {
          font-size: 13px;
          line-height: 1.6;
          margin-top: 8px;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          line-clamp: 2;
          overflow: hidden;
        }
        .bl-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          list-style: none;
          margin-top: 10px;
        }
        .bl-chip {
          position: relative;
          z-index: 0;
          display: inline-block;
          font-size: 10.5px;
          font-weight: 800;
          color: #fff;
          padding: 3px 10px;
        }
        .bl-chip::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          filter: url(#tape-edge);
        }
        .bl-chip.red::before {
          background: var(--red);
        }
        .bl-chip.blue::before {
          background: var(--blue);
        }
        .bl-times {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-top: 10px;
        }
        .bl-times li {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 6px;
          font-size: 12px;
        }
        .bl-day {
          font-size: 13px;
        }
        /* 曜日色はポスター準拠(SAT=青/SUN=赤)。entry/[id].astroの.dayと同じ規則 */
        .bl-day.sat {
          color: var(--blue);
        }
        .bl-day.sun {
          color: var(--red);
        }
        .bl-time {
          color: #444;
        }
        .bl-location {
          font-size: 12px;
          margin-top: 8px;
          color: #555;
        }
        .bl-more {
          display: inline-block;
          margin-top: 10px;
          font-size: 13px;
          font-weight: 700;
          text-decoration: underline;
        }
        @media (min-width: 900px) {
          .bl-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
          }
        }
      `}</style>
    </div>
  );
}
