"use client";

// intake-review-panel.tsx — Task 12: internal review workflow for website
// intake mandates (source: "Website", leadId: null, stage: "NewLead").
// Shows the auto-computed qualification verdict/reasons from Task 11's
// intake wizard and lets an Admin/DealLead accept (assign a deal lead),
// deprioritize (drop + reason), or re-run qualification against the
// persisted client/mandate data. Rendered only when the caller has already
// gated visibility (source + leadId + lens + RBAC) — see mandates/[id]/page.tsx.

import { useState } from "react";
import { Card, CardHeader, CardBody, Badge, Button, Select } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useIntakeReview } from "./use-intake-review";

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

export interface IntakeApplicantContact {
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
}

export interface IntakeReviewPanelProps {
  mandateId: string;
  verdict: string | null;
  reasons: string[];
  qualifiedAt: string | null;
  /** Assignable deal leads (relationOptions().users). */
  users: { value: string; label: string }[];
  /** Admin/DealLead lens + can(orgRole, "Mandates", "U") — decided by the page. */
  canReview: boolean;
  /** F2.3: the applicant from intake step 2 — stored all along, shown nowhere. */
  contact?: IntakeApplicantContact | null;
  submittedAt?: string | null;
}

function ApplicantRow({ label: rowLabel, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">{rowLabel}</dt>
      <dd className="mt-0.5 text-sm text-[var(--text-primary)]">{value || "—"}</dd>
    </div>
  );
}

export function IntakeReviewPanel({
  mandateId,
  verdict,
  reasons,
  qualifiedAt,
  users,
  canReview,
  contact,
  submittedAt,
}: IntakeReviewPanelProps) {
  const review = useIntakeReview();
  const { pending, error } = review;

  const [leadId, setLeadId] = useState("");
  const [reason, setReason] = useState("");

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Intake Review</h2>
        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Submitted via the public intake wizard — awaiting a deal-lead decision.</p>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* F2.3 (image4): who actually applied. Without this the reviewer had to
            open the client record to find the person to reply to. */}
        {(contact || submittedAt) && (
          <dl
            className="grid grid-cols-1 gap-x-8 gap-y-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 sm:grid-cols-2"
            data-testid="intake-applicant"
          >
            <ApplicantRow label="Contact person" value={contact?.name ?? null} />
            <ApplicantRow label="Role" value={contact?.jobTitle ?? null} />
            <ApplicantRow label="Corporate email" value={contact?.email ?? null} />
            <ApplicantRow label="Phone" value={contact?.phone ?? null} />
            <ApplicantRow label="Submitted" value={submittedAt ? formatDate(submittedAt) : null} />
          </dl>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {verdict && <Badge tone={VERDICT_TONE[verdict] ?? "neutral"}>{VERDICT_LABEL[verdict] ?? verdict}</Badge>}
          {qualifiedAt && (
            <span className="text-xs text-[var(--text-tertiary)]">Assessed {formatDate(qualifiedAt)}</span>
          )}
        </div>

        {reasons.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)]">No qualification flags.</p>
        )}

        {canReview && (
          <div className="space-y-4 border-t border-[var(--border-subtle)] pt-4">
            {/* Accept & assign */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Accept &amp; assign</p>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select options={users} value={leadId} onChange={setLeadId} placeholder="Select a deal lead…" aria-label="Assign deal lead" />
                </div>
                <Button
                  size="sm"
                  disabled={!leadId || pending !== null}
                  onClick={() => review.accept(mandateId, leadId)}
                >
                  {pending === "accept" ? "Assigning…" : "Accept & assign"}
                </Button>
              </div>
            </div>

            {/* Deprioritize */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Deprioritize</p>
              <textarea
                className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                rows={2}
                placeholder="Reason for deprioritizing…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-label="Deprioritize reason"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={!reason.trim() || pending !== null}
                onClick={() => review.deprioritize(mandateId, reason.trim())}
              >
                {pending === "deprioritize" ? "Deprioritizing…" : "Deprioritize"}
              </Button>
            </div>

            {/* Re-run qualification */}
            <div>
              <Button
                variant="secondary"
                size="sm"
                disabled={pending !== null}
                onClick={() => review.rerun(mandateId)}
              >
                {pending === "rerun" ? "Re-running…" : "Re-run qualification"}
              </Button>
            </div>

            {error && <p className="text-xs text-rose-600">{error}</p>}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
