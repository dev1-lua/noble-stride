"use client";

// deals-filter-bar.tsx — search + filters + group-by for the unified deals
// queue. Redesigned for the Aug-2026 feedback (F4.1.4/image16: "the filters
// look crowded — a simple, clean UI"):
//
//   row 1: Search · Type · Status · Lead · [More filters (n)] popover
//   row 2: one removable chip per active filter value + "Clear all"
//
// Still a client island that only mutates URL searchParams so the server page
// (`/deals`) re-queries — no client-side fetch. The registry and chip helpers
// are pure and unit-tested in src/server/domain/deals-filters.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input, MultiSelect, Select, Popover } from "@/components/ui";
import { options } from "@/lib/vocab";
import { TICKET_BANDS } from "@/server/domain/deals-queue";
import {
  activeFilterChips,
  moreFilterCount,
  removeChip,
  clearAllFilters,
  type FilterKey,
} from "@/server/domain/deals-filters";

// Multi-value params are comma-joined in the URL, e.g. ?status=Won,Lost.
// Empty/absent param → empty array → no constraint.
function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

const SEARCH_DEBOUNCE_MS = 300;

export function DealsFilterBar({
  leads,
  assists,
  countries,
}: {
  leads: { value: string; label: string }[];
  assists: { value: string; label: string }[];
  countries: { value: string; label: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  const push = useCallback(
    (qs: string) => router.push(qs ? `${pathname}?${qs}` : pathname),
    [router, pathname],
  );

  const update = useCallback(
    (key: string, value: string) => {
      const p = new URLSearchParams(sp.toString());
      if (value) p.set(key, value);
      else p.delete(key);
      if (key !== "page") p.delete("page"); // reset paging on any filter change
      push(p.toString());
    },
    [sp, push],
  );

  const updateMulti = useCallback(
    (key: string, values: string[]) => update(key, values.join(",")),
    [update],
  );

  // Search is debounced so typing doesn't push a history entry per keystroke.
  const [search, setSearch] = useState(sp.get("q") ?? "");
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
    const current = sp.get("q") ?? "";
    if (search === current) return;
    const t = setTimeout(() => {
      if (searchRef.current === search) update("q", search);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search, sp, update]);

  const typeOpts = [
    { value: "mandate", label: "Mandate" },
    { value: "transaction", label: "Transaction" },
    { value: "advisory", label: "Advisory" },
  ];
  const statusOpts = options("DealStatus");
  const sectorOpts = options("Sector");
  const ticketOpts = TICKET_BANDS.map((b) => ({ value: b.value, label: b.label }));
  const priorityOpts = options("Priority");
  const sourceOpts = options("Source");
  const financingOpts = options("DealFinancingType");
  const classificationOpts = options("AdvisoryClassification");
  const groupOpts = [{ value: "", label: "No grouping" }, ...options("DealQueueGroupBy")];

  // value → label per filter, so a chip reads "Classification: Due Diligence".
  const optionLabels: Partial<Record<FilterKey, Record<string, string>>> = {};
  const asMap = (opts: { value: string; label: string }[]) =>
    Object.fromEntries(opts.map((o) => [o.value, o.label]));
  optionLabels.type = asMap(typeOpts);
  optionLabels.status = asMap(statusOpts);
  optionLabels.sector = asMap(sectorOpts);
  optionLabels.ticket = asMap(ticketOpts);
  optionLabels.priority = asMap(priorityOpts);
  optionLabels.source = asMap(sourceOpts);
  optionLabels.financing = asMap(financingOpts);
  optionLabels.classification = asMap(classificationOpts);

  const chips = activeFilterChips(sp, optionLabels);
  const moreCount = moreFilterCount(sp);
  const hasAnyFilter = chips.length > 0 || Boolean(sp.get("q"));

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Row 1 — search + the three filters that actually get used, then the rest. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-56">
          <Input
            type="search"
            placeholder="Search deals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search deals"
            data-testid="deals-search"
          />
        </div>
        <div className="w-40">
          <MultiSelect options={typeOpts} selected={parseList(sp.get("type"))} onChange={(v) => updateMulti("type", v)} placeholder="Type" aria-label="Filter by type" />
        </div>
        <div className="w-44">
          <MultiSelect options={statusOpts} selected={parseList(sp.get("status"))} onChange={(v) => updateMulti("status", v)} placeholder="Status" aria-label="Filter by status" />
        </div>
        <div className="w-44">
          <MultiSelect options={leads} selected={parseList(sp.get("lead"))} onChange={(v) => updateMulti("lead", v)} placeholder="Lead" aria-label="Filter by lead" />
        </div>

        <Popover
          label="More filters"
          badge={moreCount}
          panelClassName="w-80"
          data-testid="deals-more-filters"
        >
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              More filters
            </p>
            <MultiSelect label="Sector" options={sectorOpts} selected={parseList(sp.get("sector"))} onChange={(v) => updateMulti("sector", v)} placeholder="Any" />
            <MultiSelect label="Ticket" options={ticketOpts} selected={parseList(sp.get("ticket"))} onChange={(v) => updateMulti("ticket", v)} placeholder="Any" />
            {countries.length > 0 && (
              <MultiSelect label="Country" options={countries} selected={parseList(sp.get("country"))} onChange={(v) => updateMulti("country", v)} placeholder="Any" />
            )}
            <MultiSelect label="Assist" options={assists} selected={parseList(sp.get("assist"))} onChange={(v) => updateMulti("assist", v)} placeholder="Any" />
            <MultiSelect label="Financing" options={financingOpts} selected={parseList(sp.get("financing"))} onChange={(v) => updateMulti("financing", v)} placeholder="Any" />
            <MultiSelect label="Priority" options={priorityOpts} selected={parseList(sp.get("priority"))} onChange={(v) => updateMulti("priority", v)} placeholder="Any" />
            <MultiSelect label="Source" options={sourceOpts} selected={parseList(sp.get("source"))} onChange={(v) => updateMulti("source", v)} placeholder="Any" />
            {/* F4.2.1 — advisory work type; only advisory rows carry one. */}
            <MultiSelect label="Classification" options={classificationOpts} selected={parseList(sp.get("classification"))} onChange={(v) => updateMulti("classification", v)} placeholder="Any" />
            <div className="border-t border-[var(--border-subtle)] pt-3">
              {/* Group-by is a VIEW control, not a filter — kept here to free the bar. */}
              <Select label="Group by" options={groupOpts} value={sp.get("group") ?? ""} onChange={(v) => update("group", v)} />
            </div>
          </div>
        </Popover>
      </div>

      {/* Row 2 — active filters as removable chips. */}
      {hasAnyFilter && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="deals-active-filters">
          {sp.get("q") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                update("q", "");
              }}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
            >
              Search: {sp.get("q")}
              <span aria-hidden="true">×</span>
              <span className="sr-only">Clear search</span>
            </button>
          )}
          {chips.map((c) => (
            <button
              key={`${c.key}:${c.value}`}
              type="button"
              onClick={() => push(removeChip(new URLSearchParams(sp.toString()), c.key, c.value))}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
              data-testid={`deals-chip-${c.key}-${c.value}`}
            >
              {c.label}
              <span aria-hidden="true">×</span>
              <span className="sr-only">Remove filter {c.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setSearch("");
              push(clearAllFilters(new URLSearchParams(sp.toString())));
            }}
            className="ml-1 text-[11px] font-medium text-[var(--accent)] hover:underline"
            data-testid="deals-clear-all"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
