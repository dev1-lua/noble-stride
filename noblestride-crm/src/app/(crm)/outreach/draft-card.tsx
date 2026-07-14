"use client";
// draft-card.tsx — one review card per outreach draft. Two independent
// <form>s (send / reject), each wired to its own useActionState — this
// mirrors the established pattern in settings/users/user-actions-client.tsx
// rather than routing a second action through a submit button's
// `formAction` prop (unproven in this codebase; see task-6-report.md).

import { useActionState } from "react";
import { Button, Badge } from "@/components/ui";
import { sendDraftAction, rejectDraftAction, type DraftActionState } from "./actions";

export interface DraftCardData {
  id: string;
  subject: string;
  body: string;
  matchRationale: string;
  status: string;
  error: string | null;
  investorName: string;
  contactLine: string | null;
  mayReview: boolean;
}

const initial: DraftActionState = {};

export function DraftCard({ draft }: { draft: DraftCardData }) {
  const [sendState, sendAction, sending] = useActionState(sendDraftAction, initial);
  const [rejectState, rejectAction, rejecting] = useActionState(rejectDraftAction, initial);
  const err = sendState.error ?? rejectState.error;

  return (
    <div className="rounded-lg border border-[var(--border-strong)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-[var(--text-primary)]">{draft.investorName}</div>
          <div className="text-xs text-[var(--text-tertiary)]">
            {draft.contactLine ?? "No contact email on file"} · {draft.matchRationale}
          </div>
        </div>
        <Badge tone={draft.status === "Failed" ? "danger" : "neutral"}>{draft.status}</Badge>
      </div>
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
  );
}
