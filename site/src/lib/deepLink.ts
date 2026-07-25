/**
 * map ⇄ booth/timetable 間のディープリンク契約。
 * 例: buildFilterUrl("/booth/", { tab: "出店", tags: ["飲食-フード"], scrollTo: "list" })
 *  -> "/booth/?tab=出店&tags=飲食-フード#list"
 */
export interface FilterLinkParams {
  tab?: string;
  tags?: string[];
  scrollTo?: string;
}

export function buildFilterUrl(path: string, params: FilterLinkParams): string {
  const search = new URLSearchParams();
  if (params.tab) search.set("tab", params.tab);
  if (params.tags && params.tags.length > 0) search.set("tags", params.tags.join(","));
  const query = search.toString();
  const hash = params.scrollTo ? `#${params.scrollTo}` : "";
  return `${path}${query ? `?${query}` : ""}${hash}`;
}

export function parseFilterParams(search: string): { tab: string | null; tags: string[] } {
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  const tagsRaw = params.get("tags");
  const tags = tagsRaw ? tagsRaw.split(",").filter(Boolean) : [];
  return { tab, tags };
}
