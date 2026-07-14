"use client";
// change-card.tsx — one review card per pending investor proposed change.
// Two independent <form>s (confirm / reject), each wired to its own
// useActionState — mirrors the DraftCard pattern from /outreach (Task 6)
// rather than routing both actions through a single form's submit buttons.

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { confirmChangeAction, rejectChangeAction, type ChangeActionState } from "./actions";

export interface ChangeCardField {
  key: string;
  current: string;
  proposed: string;
}

export interface ChangeCardData {
  id: string;
  investorName: string;
  contactName: string | null;
  sourceEmail: string;
  summary: string;
  createdAt: string;
  fields: ChangeCardField[];
}

const initial: ChangeActionState = {};

export function ChangeCard({ change }: { change: ChangeCardData }) {
  const [confirmState, confirmAction, confirming] = useActionState(confirmChangeAction, initial);
  const [rejectState, rejectAction, rejecting] = useActionState(rejectChangeAction, initial);
  const err = confirmState.error ?? rejectState.error;

  return (
    <div className="rounded-lg border border-[var(--border-strong)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-[var(--text-primary)]">{change.investorName}</div>
          <div className="text-xs text-[var(--text-tertiary)]">
            {change.contactName ?? "No contact on file"} · {change.sourceEmail}
          </div>
        </div>
        <span className="text-xs text-[var(--text-tertiary)]">
          {new Date(change.createdAt).toLocaleDateString()}
        </span>
      </div>

      <p className="text-sm text-[var(--text-secondary)]">{change.summary}</p>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[var(--text-tertiary)]">
            <th className="py-1 pr-2 font-medium">Field</th>
            <th className="py-1 pr-2 font-medium">Current</th>
            <th className="py-1 pr-2 font-medium">Proposed</th>
          </tr>
        </thead>
        <tbody>
          {change.fields.map((f) => (
            <tr key={f.key} className="border-t border-[var(--border-subtle)]">
              <td className="py-1 pr-2 text-[var(--text-primary)]">{f.key}</td>
              <td className="py-1 pr-2 text-[var(--text-tertiary)]">{f.current}</td>
              <td className="py-1 pr-2 text-[var(--text-primary)]">{f.proposed}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex gap-2">
        <form action={confirmAction}>
          <input type="hidden" name="changeId" value={change.id} />
          <Button type="submit" size="sm" disabled={confirming || rejecting}>
            {confirming ? "Confirming…" : "Confirm"}
          </Button>
        </form>
        <form action={rejectAction}>
          <input type="hidden" name="changeId" value={change.id} />
          <Button type="submit" size="sm" variant="secondary" disabled={confirming || rejecting}>
            {rejecting ? "Rejecting…" : "Reject"}
          </Button>
        </form>
      </div>

      {err && <p className="text-xs text-red-500">{err}</p>}
    </div>
  );
}
