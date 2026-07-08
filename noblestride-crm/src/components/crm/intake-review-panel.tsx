"use client";

// intake-review-panel.tsx — Task 12: internal review workflow for website
// intake mandates (source: "Website", leadId: null, stage: "NewLead").
// Shows the auto-computed qualification verdict/reasons from Task 11's
// intake wizard and lets an Admin/DealLead accept (assign a deal lead),
// deprioritize (drop + reason), or re-run qualification against the
// persisted client/mandate data. Rendered only when the caller has already
// gated visibility (source + leadId + lens + RBAC) — see mandates/[id]/page.tsx.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";
import { Card, CardHeader, CardBody, Badge, Button, Select } from "@/components/ui";
import { formatDate } from "@/lib/format";

const ACCEPT_INTAKE_MANDATE = `
  mutation AcceptIntakeMandate($id: ID!, $leadId: ID!) {
    acceptIntakeMandate(id: $id, leadId: $leadId) { id leadId }
  }
`;
const DEPRIORITIZE_INTAKE_MANDATE = `
  mutation DeprioritizeIntakeMandate($id: ID!, $reason: String!) {
    deprioritizeIntakeMandate(id: $id, reason: $reason) { id dealStatus notes }
  }
`;
const RERUN_QUALIFICATION = `
  mutation RerunQualification($id: ID!) {
    rerunQualification(id: $id) { id qualificationVerdict qualificationReasons qualifiedAt }
  }
`;

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

export interface IntakeReviewPanelProps {
  mandateId: string;
  verdict: string | null;
  reasons: string[];
  qualifiedAt: string | null;
  /** Assignable deal leads (relationOptions().users). */
  users: { value: string; label: string }[];
  /** Admin/DealLead lens + can(orgRole, "Mandates", "U") — decided by the page. */
  canReview: boolean;
}

export function IntakeReviewPanel({ mandateId, verdict, reasons, qualifiedAt, users, canReview }: IntakeReviewPanelProps) {
  const router = useRouter();
  const [, acceptIntake] = useMutation(ACCEPT_INTAKE_MANDATE);
  const [, deprioritizeIntake] = useMutation(DEPRIORITIZE_INTAKE_MANDATE);
  const [, rerun] = useMutation(RERUN_QUALIFICATION);

  const [leadId, setLeadId] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string, fn: () => Promise<{ error?: { message: string } }>) {
    setPending(action);
    setError(null);
    const res = await fn();
    setPending(null);
    if (res.error) setError(res.error.message);
    else router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Intake Review</h2>
        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Submitted via the public intake wizard — awaiting a deal-lead decision.</p>
      </CardHeader>
      <CardBody className="space-y-4">
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
                  onClick={() => run("accept", () => acceptIntake({ id: mandateId, leadId }))}
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
                onClick={() => run("deprioritize", () => deprioritizeIntake({ id: mandateId, reason: reason.trim() }))}
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
                onClick={() => run("rerun", () => rerun({ id: mandateId }))}
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
