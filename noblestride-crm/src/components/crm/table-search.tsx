"use client";

import { useMemo, useState } from "react";
import { Input, MultiSelect } from "@/components/ui";
import { applyTableFilters, type TableFilter } from "./table-filter";

export type { TableFilter } from "./table-filter";
export interface TableSearchProps<T> {
  rows: T[];
  searchText: (row: T) => string[];
  filters?: TableFilter<T>[];
  searchPlaceholder?: string;
  /** Shown when there is no data at all (before any search/filter is applied). */
  emptyLabel?: string;
  children: (filtered: T[]) => React.ReactNode;
}

export function TableSearch<T>({
  rows,
  searchText,
  filters = [],
  searchPlaceholder = "Search…",
  emptyLabel = "Nothing here yet.",
  children,
}: TableSearchProps<T>) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Record<string, string[]>>({});
  const filtered = useMemo(
    () => applyTableFilters(rows, query, active, searchText, filters),
    [rows, query, active, searchText, filters],
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input type="search" placeholder={searchPlaceholder} value={query}
            onChange={(e) => setQuery(e.target.value)} aria-label={searchPlaceholder} />
        </div>
        {filters.map((f) => (
          <div key={f.key} className="w-44">
            <MultiSelect
              options={f.options}
              selected={active[f.key] ?? []}
              onChange={(next) => setActive((a) => ({ ...a, [f.key]: next }))}
              placeholder={`All ${f.label}`}
              aria-label={f.label}
            />
          </div>
        ))}
      </div>
      <p className="text-sm text-[var(--text-tertiary)]">
        Showing {filtered.length} of {rows.length}
      </p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-6 text-sm text-[var(--text-tertiary)]">
          {emptyLabel}
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-6 text-sm text-[var(--text-tertiary)]">
          No matches.
        </p>
      ) : (
        children(filtered)
      )}
    </div>
  );
}
