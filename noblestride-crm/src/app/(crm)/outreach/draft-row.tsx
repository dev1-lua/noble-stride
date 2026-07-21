"use client";
// draft-row.tsx — one investor draft as a COLLAPSED summary row that expands to
// the full editor on "Review". The editor + the two independent <form>s
// (send / reject), each on its own useActionState, are the SAME wiring as the
// previous draft-card.tsx — only the collapse wrapper is new. Per-row state is
// instance-local, so many rows on the page never share/clobber state.

import { useActionState, useState } from "react";
import { Button, Badge } from "@/components/ui";
import { sendDraftAction, rejectDraftAction, type DraftActionState } from "./actions";
import type { DraftRowData } from "./queue-view";

const initial: DraftActionState = {};

export function DraftRow({ draft }: { draft: DraftRowData }) {
  const [open, setOpen] = useState(false);
  const [sendState, sendAction, sending] = useActionState(sendDraftAction, initial);
  const [rejectState, rejectAction, rejecting] = useActionState(rejectDraftAction, initial);
  const err = sendState.error ?? rejectState.error;

  return (
    <div className="rounded-lg border border-[var(--border-strong)]">
      {/* Collapsed summary — click to expand/collapse the editor. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        <span className="text-[var(--text-tertiary)]">{open ? "▾" : "▸"}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--text-primary)]">{draft.investorName}</span>
          <span className="block truncate text-xs text-[var(--text-tertiary)]">
            {draft.contactLine ?? "No contact email on file"} · {draft.matchRationale}
          </span>
        </span>
        <Badge tone={draft.status === "Failed" ? "danger" : "neutral"}>{draft.status}</Badge>
        <span className="text-xs text-[var(--text-tertiary)]">{open ? "Hide" : "Review"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-[var(--border-subtle)] p-3">
          {draft.error && <p className="text-xs text-[var(--t-tag-text-amber)]">Last error: {draft.error}</p>}

          <form action={sendAction} className="space-y-2">
            <input type="hidden" name="draftId" value={draft.id} />
            <input
              name="subject"
              defaultValue={draft.subject}
              disabled={!draft.mayReview}
              className="w-full rounded border border-[var(--border-strong)] bg-transparent px-2 py-1 text-sm"
            />
            <textarea
              name="body"
              defaultValue={draft.body}
              rows={8}
              disabled={!draft.mayReview}
              className="w-full rounded border border-[var(--border-strong)] bg-transparent px-2 py-1 text-sm font-mono"
            />
            {draft.mayReview && (
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={sending || rejecting}>
                  {sending ? "Sending…" : "Approve & Send"}
                </Button>
              </div>
            )}
          </form>

          {draft.mayReview && (
            <form action={rejectAction}>
              <input type="hidden" name="draftId" value={draft.id} />
              <Button type="submit" size="sm" variant="secondary" disabled={sending || rejecting}>
                {rejecting ? "Rejecting…" : "Reject"}
              </Button>
            </form>
          )}

          {err && <p className="text-xs text-red-500">{err}</p>}
          {sendState.ok && <p className="text-xs text-[var(--t-tag-text-emerald)]">Sent.</p>}
        </div>
      )}
    </div>
  );
}
