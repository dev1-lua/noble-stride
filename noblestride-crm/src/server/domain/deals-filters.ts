// deals-filters.ts — pure registry + chip helpers for the redesigned deals
// filter bar (Aug-2026 feedback F4.1.4/image16: "filters look crowded → a
// simple, clean filter bar"). Three primary controls stay on the bar; the rest
// live behind "More filters", and whatever is active is echoed as removable
// chips underneath. No DB, no React.

/** Always visible on the bar (besides the search box). */
export const PRIMARY_FILTERS = ["type", "status", "lead"] as const;

/** Collapsed behind the "More filters" popover. */
export const MORE_FILTERS = [
  "sector",
  "ticket",
  "country",
  "assist",
  "financing",
  "priority",
  "source",
  "classification",
] as const;

export type PrimaryFilterKey = (typeof PRIMARY_FILTERS)[number];
export type MoreFilterKey = (typeof MORE_FILTERS)[number];
export type FilterKey = PrimaryFilterKey | MoreFilterKey;

export const FILTER_LABELS: Record<FilterKey, string> = {
  type: "Type",
  status: "Status",
  lead: "Lead",
  sector: "Sector",
  ticket: "Ticket",
  country: "Country",
  assist: "Assist",
  financing: "Financing",
  priority: "Priority",
  source: "Source",
  classification: "Classification",
};

export const ALL_FILTERS: FilterKey[] = [...PRIMARY_FILTERS, ...MORE_FILTERS];

/** Params the chip row and "Clear all" must never touch (display state). */
export const DISPLAY_PARAMS = ["view", "cols", "sort", "dir", "group", "page"] as const;

export interface FilterChip {
  key: FilterKey;
  value: string;
  /** "<Filter>: <option label>" — the option label when known, else the raw value. */
  label: string;
}

type ParamReader = { get(key: string): string | null };

function values(sp: ParamReader, key: string): string[] {
  const raw = sp.get(key);
  return raw ? raw.split(",").filter(Boolean) : [];
}

/**
 * One chip per active filter value, in registry order (primary first).
 * `optionLabels` maps a filter key to value→label so a chip reads
 * "Classification: Due Diligence" rather than the raw enum.
 */
export function activeFilterChips(
  sp: ParamReader,
  optionLabels: Partial<Record<FilterKey, Record<string, string>>> = {},
): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const key of ALL_FILTERS) {
    for (const value of values(sp, key)) {
      const pretty = optionLabels[key]?.[value] ?? value;
      chips.push({ key, value, label: `${FILTER_LABELS[key]}: ${pretty}` });
    }
  }
  return chips;
}

/** How many filter dimensions in the "More filters" group are active. */
export function moreFilterCount(sp: ParamReader): number {
  return MORE_FILTERS.filter((k) => values(sp, k).length > 0).length;
}

/**
 * Remove one value from one filter, returning the next query string (paging
 * reset, display params untouched). Removing the last value drops the param.
 */
export function removeChip(sp: URLSearchParams, key: FilterKey, value: string): string {
  const next = new URLSearchParams(sp.toString());
  const remaining = values(next, key).filter((v) => v !== value);
  if (remaining.length > 0) next.set(key, remaining.join(","));
  else next.delete(key);
  next.delete("page");
  return next.toString();
}

/**
 * Drop every filter (and the search box), keeping display params — but never
 * `page`: after clearing filters the result set changes, so page N would
 * likely be empty.
 */
export function clearAllFilters(sp: URLSearchParams): string {
  const next = new URLSearchParams();
  for (const key of DISPLAY_PARAMS) {
    if (key === "page") continue;
    const v = sp.get(key);
    if (v) next.set(key, v);
  }
  return next.toString();
}
