import { type CSSProperties, useEffect, useRef, useState } from "react";
import "./TimetableList.css";
import EntryPhotoImg from "../EntryPhotoImg";
import TabTagFilter, { type TabConfig } from "../filter/TabTagFilter";
import { getChuyasaiSlots, getOngoingEntries, getScheduledSlots } from "../../lib/entries";
import { buildFilterUrl, parseFilterParams } from "../../lib/deepLink";
import { formatDayLabel } from "../../lib/eventDate";
import { isOccurrenceNow } from "../../lib/now";
import type { Day, Entry } from "../../types/content";
import site from "../../data/site.json";

interface Props {
  entries: Entry[];
}

/**
 * timetableに載せるのは各タブの`stages`に並べたステージの企画だけ（requirements.md §3.5）。
 * 時刻を持っていてもステージ以外で開催する企画（ワークショップ等）は、
 * ここで**意図的に**落としている。バグではないので、載っていない企画を見つけても
 * このフィルタを緩めないこと。会場内の特定ステージに紐づかない企画は、
 * トップのpickupやnewsで扱う方針。
 */
const DAY_STAGES = ["MainStage", "LiveStage", "SubStage"];
/** 中夜祭は第一体育館のライブステージとT字ステージだけで行う */
const CHUYASAI_STAGES = ["LiveStage", "T字ステージ"];

/** 列の色分け用のclass名。locationの値（日本語を含む）をそのままclassにしないための対応表 */
const STAGE_CLASS: Record<string, string> = {
  MainStage: "main",
  LiveStage: "live",
  SubStage: "sub",
  T字ステージ: "t",
};

type TabId = Day | "chuyasai";

interface TimetableTab {
  id: TabId;
  label: string;
  /** 列に並べるステージ（左から） */
  stages: string[];
  /** 軸の範囲（0時からの分）。これより早く始まる/遅く終わる企画が入ったら、切れないよう軸のほうを延ばす */
  axisStart: number;
  axisEnd: number;
}

/**
 * タブの並びは時系列どおり「1日目 → 中夜祭（1日目の夜） → 2日目」。
 * 1日目は15:00から中夜祭になるので、1日目タブは15:00で切り、以降は中夜祭タブに出す。
 */
const TABS: TimetableTab[] = [
  { id: "day1", label: formatDayLabel("day1"), stages: DAY_STAGES, axisStart: 9 * 60, axisEnd: 15 * 60 },
  { id: "chuyasai", label: "中夜祭", stages: CHUYASAI_STAGES, axisStart: 15 * 60, axisEnd: 18 * 60 },
  { id: "day2", label: formatDayLabel("day2"), stages: DAY_STAGES, axisStart: 9 * 60, axisEnd: 16 * 60 },
];
const TAB_OPTIONS: TabConfig[] = TABS.map(({ id, label }) => ({ id, label }));

const DESKTOP_QUERY = "(min-width: 900px)";
const PX_PER_HOUR_SP = 140;
const PX_PER_HOUR_PC = 170;
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
  const [activeTab, setActiveTab] = useState<TabId>(TABS[0].id);
  const [isDesktop, setIsDesktop] = useState(false);
  const isFirstSync = useRef(true);

  useEffect(() => {
    const { tab } = parseFilterParams(window.location.search);
    if (tab && TABS.some((t) => t.id === tab)) setActiveTab(tab as TabId);
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
    const url = buildFilterUrl("/timetable/", { tab: activeTab });
    window.history.replaceState(null, "", url);
  }, [activeTab]);

  const permanentEntries = getOngoingEntries(entries);
  const tab = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const isChuyasai = tab.id === "chuyasai";
  const slots = (isChuyasai ? getChuyasaiSlots(entries) : getScheduledSlots(entries, tab.id as Day)).filter((slot) =>
    tab.stages.includes(slot.entry.location ?? ""),
  );

  const starts = slots.map((slot) => toMinutes(slot.occurrence.start_time as string));
  const ends = slots.map((slot) => toMinutes(slot.occurrence.end_time as string));
  const axisStart = starts.length > 0 ? Math.min(tab.axisStart, Math.floor(Math.min(...starts) / 60) * 60) : tab.axisStart;
  const axisEnd = ends.length > 0 ? Math.max(tab.axisEnd, Math.ceil(Math.max(...ends) / 60) * 60) : tab.axisEnd;

  const hourMarks: number[] = [];
  for (let t = axisStart; t <= axisEnd; t += 60) hourMarks.push(t);

  const yFor = (minutes: number) => (minutes - axisStart) * PX_PER_MINUTE;
  const CARD_GAP = 5;
  const columns = tab.stages.map((stage) => {
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

  // 中夜祭の開場〜入場の時間帯。人が出る枠ではないので企画カードにはせず、全列にまたがる帯で見せる
  const doors = isChuyasai
    ? { top: yFor(toMinutes(site.chuyasai.doorsOpen)), bottom: yFor(toMinutes(site.chuyasai.admissionEnd)) }
    : null;

  return (
    <div className="timetable-list" id="list">
      <TabTagFilter
        tabs={TAB_OPTIONS}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
        selectedTags={[]}
        onTagsChange={() => {}}
      />

      {/* 一般の来場者が15時以降に体育館へ向かわないよう、何より先に在校生限定であることを出す */}
      {isChuyasai && (
        <div className="tl-notice">
          <p className="tl-notice-title">在校生限定</p>
          <p>中夜祭は鈴鹿高専の在校生のみ参加できます。一般の方はご入場いただけません。</p>
          <p className="tl-notice-venue">
            会場：{site.chuyasai.venue}
            <span className="num">（{site.chuyasai.doorsOpen} 開場）</span>
          </p>
        </div>
      )}

      <div className="tl-grid-wrap">
        <div className="tl-grid" style={{ "--stage-count": tab.stages.length } as CSSProperties}>
          <div className="tl-corner" aria-hidden="true" />
          {tab.stages.map((stage) => (
            <div key={stage} className={`tl-col-header tl-stage-${STAGE_CLASS[stage]}`}>
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

          {/* 開場の帯を同じ行に重ねるので、列本体は位置を明示しておく（自動配置だと帯と取り合いになる） */}
          {columns.map(({ stage, blocks }, col) => (
            <div
              key={stage}
              className={`tl-col-body tl-stage-${STAGE_CLASS[stage]}`}
              style={{ height: `${totalHeight}px`, gridColumn: col + 2 }}
            >
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
                    {/* 同じ企画の中の「どの回か」（バザーグランプリの中間発表／最終結果発表等） */}
                    {occurrence.note && ` ${occurrence.note}`}
                    {isOccurrenceNow(occurrence) && <span className="tl-now">NOW</span>}
                  </span>
                </a>
              ))}
            </div>
          ))}

          {doors && (
            <div className="tl-marker-layer" aria-hidden="true">
              <div className="tl-marker" style={{ top: `${doors.top}px`, height: `${doors.bottom - doors.top - CARD_GAP}px` }}>
                <span className="num">{site.chuyasai.doorsOpen}</span> 開場・入場
              </div>
            </div>
          )}
        </div>

        {slots.length === 0 && <p className="tl-empty">この日程の該当企画はまだありません</p>}
      </div>

      {/* 常設・期間中の企画はグリッドの下に置く。当日まず見たいのは時刻の表なので */}
      {permanentEntries.length > 0 && (
        <div className="tl-permanent">
          <h2 className="tl-permanent-title">常設</h2>
          <ul className="tl-permanent-list">
            {permanentEntries.map((entry) => (
              <li key={entry.id} className="tl-permanent-card">
                <div className="tl-permanent-photo">
                  {entry.image ? (
                    <EntryPhotoImg entry={entry} sizes="110px" />
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
                      {entry.linkLabel ?? "やってみる →"}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
