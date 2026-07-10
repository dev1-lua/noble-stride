"use client";

// multi-select.tsx — Searchable multi-select combobox.
// Trigger button (styled like Select) + popover panel with a search input and
// a checkable option list. Empty `selected` means "no constraint" everywhere
// this is used as a filter. Client Component (state + outside-click/Escape).

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { SelectOption } from "./select";

export interface MultiSelectProps {
  /** Optional label rendered above the trigger */
  label?: string;
  options: SelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Shown on the trigger when nothing is selected */
  placeholder?: string;
  className?: string;
  /** aria-label for the trigger when no visible `label` is rendered */
  "aria-label"?: string;
}

/**
 * MultiSelect — popover-based searchable multi-select.
 * - Trigger summarizes the selection: placeholder / single label / "N selected".
 * - Popover: search input (auto-focused on open) + scrollable checkbox list,
 *   filtered case-insensitively by the search text.
 * - Closes on outside-click and Escape. Selecting an option never closes the
 *   popover (multi-select — the user typically toggles several in a row).
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = "All",
  className,
  ...aria
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const reactId = useId();
  const listboxId = `multi-select-listbox-${reactId}`;

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Close on outside-click.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Close on Escape; focus the search box when opening.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    searchRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Reset the search text each time the popover closes so it doesn't carry
  // stale text into the next open.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function toggle(value: string) {
    const next = selectedSet.has(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(next);
  }

  function clear() {
    onChange([]);
  }

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? placeholder)
        : `${selected.length} selected`;

  return (
    <div ref={rootRef} className={cn("relative flex flex-col gap-1", className)}>
      {label && (
        <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={!label ? aria["aria-label"] : undefined}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]",
          selected.length > 0 ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"
        )}
      >
        <span className="truncate">{summary}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-[var(--text-tertiary)]"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          id={listboxId}
          className="absolute left-0 top-full z-50 mt-1 flex w-64 flex-col rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] p-2">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              aria-label={`Search ${label ?? aria["aria-label"] ?? "options"}`}
              className="h-7 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="max-h-56 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-[var(--text-tertiary)]">No matches.</p>
            ) : (
              filteredOptions.map((o) => {
                const checked = selectedSet.has(o.value);
                return (
                  <label
                    key={o.value}
                    role="option"
                    aria-selected={checked}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o.value)}
                      className="h-3.5 w-3.5 rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-[var(--accent)]"
                    />
                    <span className="truncate">{o.label}</span>
                  </label>
                );
              })
            )}
          </div>

          {selected.length > 0 && (
            <div className="border-t border-[var(--border-subtle)] p-1.5">
              <button
                type="button"
                onClick={clear}
                className="w-full rounded-md px-2 py-1 text-left text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
              >
                Clear ({selected.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
