// table-filter.ts — Pure filter logic for TableSearch — no React, so it is
// unit-testable in a plain vitest .ts test (this repo has no DOM test tooling).

export interface TableFilter<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  get: (row: T) => string;
}

/**
 * `active[key]` is the set of selected values for that filter (multi-select,
 * OR-matching): a row matches a filter when its value is in the selected set.
 * An empty/absent array imposes no constraint. A row matches overall when it
 * matches every filter (AND across filters).
 */
export function applyTableFilters<T>(
  rows: T[],
  query: string,
  active: Record<string, string[]>,
  searchText: (row: T) => string[],
  filters: TableFilter<T>[],
): T[] {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (q && !searchText(row).some((s) => (s ?? "").toLowerCase().includes(q))) return false;
    for (const f of filters) {
      const values = active[f.key];
      if (values && values.length > 0 && !values.includes(f.get(row))) return false;
    }
    return true;
  });
}
