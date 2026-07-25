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

export default function TabTagFilter({ tabs, activeTab, onTabChange, selectedTags, onTagsChange }: Props) {
  const current = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  function selectTab(tabId: string) {
    onTabChange(tabId);
    onTagsChange([]);
  }

  function toggleTag(tagId: string) {
    onTagsChange(selectedTags.includes(tagId) ? selectedTags.filter((t) => t !== tagId) : [...selectedTags, tagId]);
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
            className={`tab${tab.id === activeTab ? " is-active" : ""}`}
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
