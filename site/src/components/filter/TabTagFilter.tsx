import "./TabTagFilter.css";

export interface TagOption {
  id: string;
  label: string;
}

export interface TabConfig {
  id: string;
  label: string;
  tags?: TagOption[];
}

interface Props {
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

/** ラベルが英数字だけか（「10/31 SAT」なら true、「中夜祭」「出店」なら false）。和文のタブは字面を揃えるため小さく出す */
function isLatinLabel(label: string) {
  return /^[\x20-\x7E]*$/.test(label);
}

export default function TabTagFilter({ tabs, activeTab, onTabChange, selectedTags, onTagsChange }: Props) {
  const current = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  function selectTab(tabId: string) {
    onTabChange(tabId);
    onTagsChange([]);
  }

  /**
   * タグは1つだけ選べる。別のタグを押すと選び直し、選択中のタグをもう一度押すと解除。
   * 以前は複数選べてOR検索になっていたが、「10/31 と 飲食-フード」のような組み合わせは
   * ORだと広がるだけで使い道が無かった
   */
  function toggleTag(tagId: string) {
    onTagsChange(selectedTags.includes(tagId) ? [] : [tagId]);
  }

  return (
    <div className="tab-tag-filter">
      <div className="tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTab}
            className={`tab${tab.id === activeTab ? " is-active" : ""}${isLatinLabel(tab.label) ? "" : " is-ja"}`}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {current?.tags && current.tags.length > 0 && (
        <div className="tags" role="group" aria-label="絞り込みタグ">
          {current.tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              aria-pressed={selectedTags.includes(tag.id)}
              className={`tag-chip${selectedTags.includes(tag.id) ? " is-selected" : ""}`}
              onClick={() => toggleTag(tag.id)}
            >
              {tag.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
