"use client";
// outreach-board.tsx — client shell for the review queue. Owns all UI state
// (status filter, search, my-deals toggle, and the CONTROLLED set of expanded
// deals) and derives the visible groups purely via queue-view helpers. The
// server component (page.tsx) does the data fetch + RBAC (mayReview) and hands
// this the flat, already-authorized rows.
//
// IMPORTANT (mass-send safety): filters only affect which rows are DISPLAYED.
// Per-deal bulk actions always operate on the WHOLE deal server-side, so the
// bulk bar is driven by each deal's UNFILTERED group (see `fullByDeal`), never
// the filtered subset — otherwise "Approve & send all (2)" under a filter could
// silently release every draft on the deal.

import { useMemo, useState } from "react";
import { Button, Select } from "@/components/ui";
import { DealSection } from "./deal-section";
import { filterRows, groupByDeal, summarize, type DraftRowData, type StatusFilter } from "./queue-view";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "Draft", label: "Draft" },
  { value: "Failed", label: "Failed" },
  { value: "Approved", label: "Approved" },
];

export function OutreachBoard({ rows, currentUserId }: { rows: DraftRowData[]; currentUserId?: string }) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [myDealsOnly, setMyDealsOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const summary = useMemo(() => summarize(rows), [rows]);
  // Full (unfiltered) group per deal — drives the bulk bar's count + recipients.
  const fullByDeal = useMemo(() => new Map(groupByDeal(rows).map((g) => [g.transactionId, g])), [rows]);
  // Visible groups — the filtered rows actually shown, in first-seen order.
  const visibleGroups = useMemo(
    () => groupByDeal(filterRows(rows, { status, search, myDealsOnly, currentUserId })),
    [rows, status, search, myDealsOnly, currentUserId],
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-[var(--text-tertiary)]">
          {summary.deals} deal{summary.deals === 1 ? "" : "s"} · {summary.drafts} draft
          {summary.drafts === 1 ? "" : "s"}
          {summary.failed > 0 && <span className="ml-1 text-[var(--t-tag-text-amber)]">· {summary.failed} failed</span>}
        </p>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deal or investor…"
            className="h-8 w-56 rounded border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <div className="w-40">
            <Select options={STATUS_OPTIONS} value={status} onChange={(v) => setStatus(v as StatusFilter)} />
          </div>
          {/* "My deals" only makes sense with a concrete user id — an Admin lens
              carries none, so hide it rather than show a toggle that matches nothing. */}
          {currentUserId && (
            <Button
              type="button"
              size="sm"
              variant={myDealsOnly ? "primary" : "secondary"}
              onClick={() => setMyDealsOnly((v) => !v)}
            >
              My deals
            </Button>
          )}
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">
          {rows.length === 0
            ? "No drafts waiting. Use “Generate investor outreach” on a deal page to create some."
            : "No drafts match the current filters."}
        </p>
      ) : (
        <div className="space-y-3">
          {visibleGroups.map((vg) => {
            const full = fullByDeal.get(vg.transactionId) ?? vg;
            return (
              <DealSection
                key={vg.transactionId}
                group={full}
                visibleRows={vg.rows}
                expanded={expanded.has(vg.transactionId)}
                onToggle={() => toggle(vg.transactionId)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
