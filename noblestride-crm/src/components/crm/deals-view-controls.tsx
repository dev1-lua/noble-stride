"use client";

// deals-view-controls.tsx — Three URL-driven controls for the unified deals
// queue header, mirroring deals-filter-bar.tsx (client island mutating URL
// searchParams so the RSC page re-queries; no client-side fetch for the
// list/board state itself).
//   1. Columns chooser — Popover of checkboxes from DEAL_COLUMNS -> ?cols=
//   2. Saved views — tucked inside a "Views" Popover (Aug-2026 feedback
//      F4.1.4: the header was crowded) + save/rename/delete via the
//      createSavedView/renameSavedView/deleteSavedView mutations.
//   3. List | Board toggle -> ?view=list|board

import { useCallback, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useMutation } from "urql";
import { Button, Select, Popover } from "@/components/ui";
import { DEAL_COLUMNS, parseColumns } from "@/server/domain/deals-queue";
import type { SavedViewConfig } from "@/server/services/saved-views";

const CREATE_SAVED_VIEW = `
  mutation CreateSavedView($name: String!, $config: String!) {
    createSavedView(name: $name, config: $config) { id }
  }
`;
const RENAME_SAVED_VIEW = `
  mutation RenameSavedView($id: ID!, $name: String!) {
    renameSavedView(id: $id, name: $name) { id }
  }
`;
const DELETE_SAVED_VIEW = `
  mutation DeleteSavedView($id: ID!) {
    deleteSavedView(id: $id) { id }
  }
`;

export interface SavedViewOption {
  id: string;
  name: string;
  config: SavedViewConfig;
  // Built-in presets (defined in code, no DB row). Read-only: applied like any
  // view, but Rename/Delete are hidden since there's no row to mutate.
  isDefault?: boolean;
}

// Params that describe queue *display* state rather than a filter dimension —
// excluded when snapshotting "current filters" for a saved view, and restored
// explicitly (not as generic filters) when a saved view is applied.
const DISPLAY_PARAMS = new Set(["sort", "dir", "group", "cols", "view", "page"]);

const DEFAULT_COLUMN_KEYS = DEAL_COLUMNS.filter((c) => c.default).map((c) => c.key);

export function DealsViewControls({ views }: { views: SavedViewOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Last view picked from the dropdown in *this* session — scopes the
  // Rename/Delete actions. Deliberately local (not URL-derived): the URL only
  // records the applied filters/sort/cols, not "which saved view produced
  // them", so it can't drift out of sync when the user tweaks a filter after
  // applying a view.
  const [selectedId, setSelectedId] = useState("");

  const [, runCreate] = useMutation(CREATE_SAVED_VIEW);
  const [, runRename] = useMutation(RENAME_SAVED_VIEW);
  const [, runDelete] = useMutation(DELETE_SAVED_VIEW);

  const activeCols = parseColumns(sp.get("cols") ?? undefined);
  const currentView = sp.get("view") === "board" ? "board" : "list";

  const pushParams = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(sp.toString());
      mutate(p);
      router.push(`${pathname}${p.toString() ? `?${p.toString()}` : ""}`);
    },
    [router, sp, pathname]
  );

  function toggleColumn(key: string) {
    const nextSet = new Set(activeCols);
    if (nextSet.has(key)) nextSet.delete(key);
    else nextSet.add(key);
    // Preserve DEAL_COLUMNS registry order regardless of click order.
    const ordered = DEAL_COLUMNS.filter((c) => nextSet.has(c.key)).map((c) => c.key);
    const isDefault =
      ordered.length === DEFAULT_COLUMN_KEYS.length && ordered.every((k, i) => k === DEFAULT_COLUMN_KEYS[i]);
    pushParams((p) => {
      if (isDefault || ordered.length === 0) p.delete("cols");
      else p.set("cols", ordered.join(","));
    });
  }

  function setView(view: "list" | "board") {
    pushParams((p) => {
      if (view === "list") p.delete("view");
      else p.set("view", view);
    });
  }

  function applySavedView(id: string) {
    setSelectedId(id);
    const view = views.find((v) => v.id === id);
    if (!view) return;
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(view.config.filters ?? {})) {
      if (v) p.set(k, v);
    }
    if (view.config.sort) p.set("sort", view.config.sort);
    if (view.config.dir) p.set("dir", view.config.dir);
    if (view.config.groupBy) p.set("group", view.config.groupBy);
    if (view.config.columns?.length) p.set("cols", view.config.columns.join(","));
    if (view.config.view === "board") p.set("view", "board");
    router.push(`${pathname}${p.toString() ? `?${p.toString()}` : ""}`);
  }

  function currentConfig(): SavedViewConfig {
    const filters: Record<string, string> = {};
    sp.forEach((value, key) => {
      if (!DISPLAY_PARAMS.has(key) && value) filters[key] = value;
    });
    return {
      filters,
      sort: sp.get("sort") ?? "dateOnboarded",
      dir: sp.get("dir") === "asc" ? "asc" : "desc",
      columns: activeCols,
      groupBy: sp.get("group") ?? "",
      view: currentView,
    };
  }

  async function saveCurrentAs() {
    const name = window.prompt("Name this view:");
    if (!name || !name.trim()) return;
    setError(null);
    setPending(true);
    const result = await runCreate({ name: name.trim(), config: JSON.stringify(currentConfig()) });
    setPending(false);
    if (result.error) {
      setError(result.error.message.replace(/^\[GraphQL\]\s*/, ""));
      return;
    }
    router.refresh();
  }

  async function renameView(view: SavedViewOption) {
    const name = window.prompt("Rename view:", view.name);
    if (!name || !name.trim() || name.trim() === view.name) return;
    setError(null);
    setPending(true);
    const result = await runRename({ id: view.id, name: name.trim() });
    setPending(false);
    if (result.error) {
      setError(result.error.message.replace(/^\[GraphQL\]\s*/, ""));
      return;
    }
    router.refresh();
  }

  async function deleteView(view: SavedViewOption) {
    if (!window.confirm(`Delete saved view "${view.name}"?`)) return;
    setError(null);
    setPending(true);
    const result = await runDelete({ id: view.id });
    setPending(false);
    if (result.error) {
      setError(result.error.message.replace(/^\[GraphQL\]\s*/, ""));
      return;
    }
    if (selectedId === view.id) setSelectedId("");
    router.refresh();
  }

  const selectedView = views.find((v) => v.id === selectedId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Columns chooser — align left: this sits at the sidebar edge, so a
          right-aligned panel would extend under the sidebar. */}
      <Popover label="Columns" panelClassName="w-64" data-testid="deals-columns">
        {DEAL_COLUMNS.map((c) => (
          <label
            key={c.key}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
          >
            <input
              type="checkbox"
              checked={activeCols.includes(c.key)}
              onChange={() => toggleColumn(c.key)}
              data-testid={`deals-col-${c.key}`}
            />
            {c.label}
          </label>
        ))}
      </Popover>

      {/* Saved views */}
      <Popover label="Views" panelClassName="w-72" data-testid="deals-views">
        <div className="flex flex-col gap-2">
          <Select
            label="Saved views"
            options={[{ value: "", label: "Saved views…" }, ...views.map((v) => ({ value: v.id, label: v.name }))]}
            value={selectedId}
            onChange={(id) => id && applySavedView(id)}
          />
          <div className="flex flex-wrap gap-1.5">
            <Button variant="secondary" size="sm" disabled={pending} onClick={saveCurrentAs} data-testid="deals-save-view">
              Save current as…
            </Button>
            {selectedView && !selectedView.isDefault && (
              <>
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => renameView(selectedView)}>
                  Rename
                </Button>
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => deleteView(selectedView)}>
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </Popover>

      {/* List | Board toggle */}
      <div className="flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-0.5 text-xs font-medium">
        <button
          type="button"
          onClick={() => setView("list")}
          className={`rounded px-2.5 py-1 transition-colors ${
            currentView === "list" ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          }`}
        >
          List
        </button>
        <button
          type="button"
          onClick={() => setView("board")}
          className={`rounded px-2.5 py-1 transition-colors ${
            currentView === "board" ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          }`}
        >
          Board
        </button>
      </div>

      {error && <p className="w-full text-xs text-rose-600">{error}</p>}
    </div>
  );
}
