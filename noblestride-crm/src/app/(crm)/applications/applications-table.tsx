"use client";

// The applications queue table (F2.1 / F2.3). Client island, because the review
// actions act on a row in place — accepting an application from here saves the
// reviewer a trip to the mandate page.
//
// The Contact column is the F2.3 fix: the intake wizard's step-2 details were
// being stored all along and shown nowhere.

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Select } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { useIntakeReview } from "@/components/crm/use-intake-review";
import type { ApplicationRow } from "@/server/services/applications";

const VERDICT_TONE: Record<string, "success" | "warning" | "danger"> = {
  Qualified: "success",
  NeedsReview: "warning",
  Deprioritized: "danger",
};

const VERDICT_LABEL: Record<string, string> = {
  Qualified: "Qualified",
  NeedsReview: "Needs Review",
  Deprioritized: "Deprioritized",
};

function ReviewActions({
  row,
  users,
  review,
}: {
  row: ApplicationRow;
  users: { value: string; label: string }[];
  review: ReturnType<typeof useIntakeReview>;
}) {
  const [leadId, setLeadId] = useState("");
  const [reason, setReason] = useState("");
  const [showDrop, setShowDrop] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1.5">
        <div className="w-44">
          <Select
            options={users}
            value={leadId}
            onChange={setLeadId}
            placeholder="Deal lead…"
            aria-label={`Assign a deal lead for ${row.company}`}
          />
        </div>
        <Button
          size="sm"
          disabled={!leadId || review.pending !== null}
          onClick={() => review.accept(row.mandateId, leadId)}
        >
          {review.pending === "accept" ? "Assigning…" : "Accept"}
        </Button>
      </div>
      {showDrop ? (
        <div className="space-y-1.5">
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for not taking this forward…"
            aria-label={`Reason for dropping ${row.company}`}
            className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-2 text-xs text-[var(--text-primary)]"
          />
          <div className="flex gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={!reason.trim() || review.pending !== null}
              onClick={() => review.deprioritize(row.mandateId, reason.trim())}
            >
              {review.pending === "deprioritize" ? "Saving…" : "Confirm"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowDrop(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => setShowDrop(true)}>
            Not taken forward
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={review.pending !== null}
            onClick={() => review.rerun(row.mandateId)}
          >
            {review.pending === "rerun" ? "Re-running…" : "Re-qualify"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ApplicationsTable({
  rows,
  users,
  canReview,
}: {
  rows: ApplicationRow[];
  users: { value: string; label: string }[];
  canReview: boolean;
}) {
  const review = useIntakeReview();

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-10 text-center text-sm text-[var(--text-tertiary)]">
        No applications here.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {review.error && (
        <p className="rounded border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] px-3 py-2 text-xs text-[var(--t-tag-text-rose)]">
          {review.error}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Verdict</th>
              <th className="px-4 py-3">Via</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.mandateId}
                data-testid="application-row"
                className="border-b border-[var(--border-subtle)] align-top last:border-0"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/mandates/${row.mandateId}`}
                    className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
                  >
                    {row.company}
                  </Link>
                  <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">{row.statusLabel}</div>
                  {row.dealSize != null && (
                    <div className="text-xs text-[var(--text-tertiary)]">
                      {formatMoney(row.dealSize, row.currency)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.contact ? (
                    <div className="text-xs text-[var(--text-secondary)]">
                      <div className="text-sm font-medium text-[var(--text-primary)]">
                        {row.contact.name}
                      </div>
                      {row.contact.jobTitle && <div>{row.contact.jobTitle}</div>}
                      {row.contact.email && (
                        <a href={`mailto:${row.contact.email}`} className="hover:text-[var(--accent)]">
                          {row.contact.email}
                        </a>
                      )}
                      {row.contact.phone && <div>{row.contact.phone}</div>}
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--text-tertiary)]">
                      No contact captured
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {formatDate(row.submittedAt)}
                </td>
                <td className="px-4 py-3">
                  {row.verdict ? (
                    <Badge tone={VERDICT_TONE[row.verdict] ?? "neutral"}>
                      {VERDICT_LABEL[row.verdict] ?? row.verdict}
                    </Badge>
                  ) : (
                    <span className="text-xs text-[var(--text-tertiary)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                  {row.via}
                  {row.documentCount > 0 && (
                    <div className="text-[var(--text-tertiary)]">
                      {row.documentCount} document{row.documentCount === 1 ? "" : "s"}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {canReview && row.tab === "awaiting" ? (
                    <ReviewActions row={row} users={users} review={review} />
                  ) : (
                    <div className="space-y-1 text-xs">
                      <Link href={`/mandates/${row.mandateId}`} className="text-[var(--accent)] hover:underline">
                        Open →
                      </Link>
                      {row.leadName && (
                        <div className="text-[var(--text-tertiary)]">Lead: {row.leadName}</div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
