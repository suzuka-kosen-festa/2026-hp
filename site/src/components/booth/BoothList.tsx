import { useEffect, useRef, useState } from "react";
import "./BoothList.css";
import EntryPhotoImg from "../EntryPhotoImg";
import TabTagFilter, { type TabConfig } from "../filter/TabTagFilter";
import PromoCard from "../motion/PromoCard";
import { getByCategory, getPermanentEntries } from "../../lib/entries";
import { buildFilterUrl, parseFilterParams } from "../../lib/deepLink";
import { dayColorClass, formatDayLabel } from "../../lib/eventDate";
import { displayTags, matchesTag, tagColor, tagLabel } from "../../lib/tags";
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
      { id: "飲食-フード", label: tagLabel("飲食-フード") },
      { id: "飲食-スイーツ", label: tagLabel("飲食-スイーツ") },
      { id: "レク", label: tagLabel("レク") },
      { id: "物販", label: tagLabel("物販") },
      { id: "展示", label: tagLabel("展示") },
    ],
  },
  {
    id: "学科展示",
    label: "学科展示",
    tags: [
      { id: "M科", label: tagLabel("M科") },
      { id: "E科", label: tagLabel("E科") },
      { id: "I科", label: tagLabel("I科") },
      { id: "C科", label: tagLabel("C科") },
      { id: "S科", label: tagLabel("S科") },
    ],
  },
  {
    id: "イベント",
    label: "イベント",
    tags: [
      { id: "day1", label: formatDayLabel("day1") },
      { id: "day2", label: formatDayLabel("day2") },
      { id: "中夜祭", label: tagLabel("中夜祭") },
      { id: "当日参加OK", label: tagLabel("当日参加OK") },
    ],
  },
  {
    id: "ライブ",
    label: "ライブ",
    tags: [
      { id: "day1", label: formatDayLabel("day1") },
      { id: "day2", label: formatDayLabel("day2") },
      { id: "中夜祭", label: tagLabel("中夜祭") },
      { id: "決勝バンド", label: tagLabel("決勝バンド") },
    ],
  },
];

/** カードから詳細ページへ飛ばすか。出店はカードで情報が出きっているので飛ばさない */
function hasDetailPage(entry: Entry) {
  return entry.category !== "出店";
}

export default function BoothList({ entries }: Props) {
  const [activeTab, setActiveTab] = useState<string>(TABS[0].id);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const isFirstSync = useRef(true);

  // マウント後にURL(?tab=&tags=)から初期状態を復元する。
  useEffect(() => {
    const { tab, tags } = parseFilterParams(window.location.search);
    if (tab && TABS.some((t) => t.id === tab)) setActiveTab(tab);
    // タグは1つだけ選べる。古いリンク等で複数来たら先頭だけ使う
    if (tags.length > 0) setSelectedTags(tags.slice(0, 1));
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
      : regularEntries.filter((entry) => selectedTags.some((tag) => matchesTag(entry, tag)));

  return (
    <div className="booth-list" id="list">
      {permanentEntries.length > 0 && (
        <div className="bl-permanent">
          {/* カード内の「常設企画」ラベルが見出しの役割を兼ねるので、黄色テープの
              見出しは出さない。ただし見出し階層とセクションの区切りは要るので、
              読み上げ用には残す */}
          <h2 className="visually-hidden">常設</h2>
          <ul className="bl-permanent-list">
            {permanentEntries.map((entry) => (
              <li key={entry.id} className="bl-permanent-card">
                {/* home の PICK UP と同じカード（PromoCard）を使う。常設セクションは
                    縦1列でカードの高さを揃える必要が無いので、「NO IMAGE」を出す
                    .bl-grid 側とは扱いを分ける（Issue #60） */}
                <a className="bl-permanent-link" href={`/entry/${entry.id}/`}>
                  <PromoCard entry={entry} more />
                </a>
                {/* カードの外に出す。中に入れるとリンクの入れ子になる */}
                {entry.link && (
                  <a className="bl-permanent-cta" href={entry.link}>
                    {entry.linkLabel ?? "やってみる →"}
                  </a>
                )}
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
        {filtered.map((entry, i) => {
          // 出店は紹介文と写真がカードで全部見えていて、詳細ページに行っても増える情報が無いので
          // リンクにせず、紹介文も省略しないで出す。場内マップができたら、ここから場所へ飛ばしたい
          const linked = hasDetailPage(entry);
          const summary = entry.summary ?? entry.description;
          const card = (
            <div className="bl-card" style={{ transform: `rotate(${i % 2 === 0 ? -0.8 : 0.9}deg)` }}>
              <div className="bl-photo">
                {entry.image ? (
                  // SPはページ幅いっぱい（本文幅の上限520px）、PCは3列
                  <EntryPhotoImg entry={entry} sizes="(min-width: 900px) 380px, min(calc(100vw - 40px), 520px)" />
                ) : (
                  <span className="bl-no-image num">NO IMAGE</span>
                )}
              </div>
              <div className="bl-body">
                <p className="bl-name">{entry.name}</p>
                {entry.group && <p className="bl-group">{entry.group}</p>}
                {summary && <p className={`bl-summary${linked ? "" : " is-full"}`}>{summary}</p>}
                {displayTags(entry.tags).length > 0 && (
                  <ul className="bl-tags">
                    {displayTags(entry.tags).map((tag) => (
                      <li key={tag}>
                        <span className={`bl-chip ${tagColor(tag)}`}>{tagLabel(tag)}</span>
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
                {linked && <span className="bl-more">view more →</span>}
              </div>
            </div>
          );
          return (
            <li key={entry.id}>
              {linked ? (
                <a className="bl-card-link" href={`/entry/${entry.id}/`}>
                  {card}
                </a>
              ) : (
                card
              )}
            </li>
          );
        })}
        {filtered.length === 0 && <li className="bl-empty">該当する企画がありません</li>}
      </ul>
    </div>
  );
}
