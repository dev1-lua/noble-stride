"use client";
// deal-section.tsx — one deal as a CONTROLLED collapsible accordion (expand
// state lives in the parent OutreachBoard's Set, so it survives filter-driven
// remounts — native <details> would lose it). The header + bulk bar reflect the
// FULL deal (`group`, unfiltered); the row list shows only `visibleRows` (the
// filtered subset). This keeps the bulk count/recipients truthful: bulk always
// acts on every reviewable draft in the deal, server-side.

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import { DraftRow } from "./draft-row";
import { approveAllForDealAction, rejectAllForDealAction, type BulkActionState } from "./actions";
import type { DealGroup, DraftRowData } from "./queue-view";

const initial: BulkActionState = {};

/** Emails the bulk send will target (best-effort preview). Only real addresses
 *  — drops the "no email" placeholder contactLine carries; the server still
 *  falls back to the investor's primary contact at send time. */
function previewRecipients(rows: DraftRowData[]): string[] {
  return rows
    .map((r) => r.contactLine?.match(/<([^>]+)>/)?.[1]?.trim())
    .filter((e): e is string => !!e && e.includes("@"));
}

export function DealSection({
  group,
  visibleRows,
  expanded,
  onToggle,
}: {
  group: DealGroup;
  visibleRows: DraftRowData[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const mayReview = group.rows[0]?.mayReview ?? false;
  const total = group.counts.total; // FULL deal count — what bulk actually sends
  const hiddenByFilter = visibleRows.length !== total;
  const [confirm, setConfirm] = useState<null | "approve" | "reject">(null);
  const [approveState, approveAction, approving] = useActionState(approveAllForDealAction, initial);
  const [rejectState, rejectAction, rejecting] = useActionState(rejectAllForDealAction, initial);
  const busy = approving || rejecting;
  const result = approveState.result ?? rejectState.result;
  const err = approveState.error ?? rejectState.error;
  const recipients = previewRecipients(group.rows);

  return (
    <section className="rounded-lg border border-[var(--border-subtle)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-[var(--text-tertiary)]">{expanded ? "▾" : "▸"}</span>
        <span className="flex-1 text-lg font-semibold text-[var(--text-primary)]">{group.dealName}</span>
        {group.ownerName && <span className="text-xs text-[var(--text-tertiary)]">owner: {group.ownerName}</span>}
        <span className="text-xs text-[var(--text-tertiary)]">
          {total} draft{total === 1 ? "" : "s"}
          {group.counts.failed > 0 && <span className="ml-1 text-[var(--t-tag-text-amber)]">· {group.counts.failed} failed</span>}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-[var(--border-subtle)] p-4">
          {mayReview && (
            <div className="space-y-2">
              {confirm === null && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" disabled={busy} onClick={() => setConfirm("approve")}>
                    Approve &amp; send all ({total})
                  </Button>
                  <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setConfirm("reject")}>
                    Reject all ({total})
                  </Button>
                </div>
              )}

              {confirm === "approve" && (
                <div className="space-y-2 rounded border border-[var(--t-tag-text-amber)] bg-[var(--bg-secondary)] p-3">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Send {total} outreach email{total === 1 ? "" : "s"} for {group.dealName}?
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    This releases real emails now, including any previously failed drafts. Unsaved edits in open rows
                    are NOT included (they send the last saved text). Final recipient is resolved at send time and may
                    use the investor’s primary contact.
                    {hiddenByFilter && (
                      <span className="font-medium text-[var(--t-tag-text-amber)]"> Filters are hiding some drafts — this sends ALL {total} in the deal, not just the visible ones.</span>
                    )}
                  </p>
                  {recipients.length > 0 && (
                    <p className="text-xs text-[var(--text-tertiary)]">Recipients: {recipients.join(", ")}</p>
                  )}
                  <form action={approveAction} className="flex gap-2">
                    <input type="hidden" name="transactionId" value={group.transactionId} />
                    <Button type="submit" size="sm" disabled={busy} onClick={() => setConfirm(null)}>
                      {approving ? "Sending…" : `Yes, send ${total}`}
                    </Button>
                    <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>
                      Cancel
                    </Button>
                  </form>
                </div>
              )}

              {confirm === "reject" && (
                <div className="space-y-2 rounded border border-[var(--border-strong)] bg-[var(--bg-secondary)] p-3">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Reject all {total} draft{total === 1 ? "" : "s"} for {group.dealName}?
                    {hiddenByFilter && (
                      <span className="font-medium text-[var(--t-tag-text-amber)]"> (Filters are hiding some — this rejects ALL {total} in the deal.)</span>
                    )}
                  </p>
                  <form action={rejectAction} className="flex gap-2">
                    <input type="hidden" name="transactionId" value={group.transactionId} />
                    <Button type="submit" size="sm" variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>
                      {rejecting ? "Rejecting…" : `Yes, reject ${total}`}
                    </Button>
                    <Button type="button" size="sm" disabled={busy} onClick={() => setConfirm(null)}>
                      Cancel
                    </Button>
                  </form>
                </div>
              )}

              {result && (
                <p className="text-xs text-[var(--text-secondary)]">
                  {result.kind === "send"
                    ? `Sent ${result.sent}, failed ${result.failed}${result.remaining ? `, ${result.remaining} remaining — run again` : ""}.`
                    : `Rejected ${result.rejected}${result.remaining ? `, ${result.remaining} remaining — run again` : ""}.`}
                </p>
              )}
              {err && <p className="text-xs text-red-500">{err}</p>}
            </div>
          )}

          <div className="space-y-2">
            {visibleRows.map((d) => (
              <DraftRow key={d.id} draft={d} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
