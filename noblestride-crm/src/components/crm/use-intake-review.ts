"use client";

// The three intake-review mutations, extracted from intake-review-panel.tsx so
// the Applications queue (F2.1) can act on a row inline without duplicating
// them. Same urql + router.refresh() pattern the rest of the client islands use.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";

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

export type IntakeReviewAction = "accept" | "deprioritize" | "rerun";

export interface UseIntakeReview {
  accept(mandateId: string, leadId: string): Promise<void>;
  deprioritize(mandateId: string, reason: string): Promise<void>;
  rerun(mandateId: string): Promise<void>;
  /** Which action is in flight, or null. */
  pending: IntakeReviewAction | null;
  error: string | null;
}

export function useIntakeReview(): UseIntakeReview {
  const router = useRouter();
  const [, acceptIntake] = useMutation(ACCEPT_INTAKE_MANDATE);
  const [, deprioritizeIntake] = useMutation(DEPRIORITIZE_INTAKE_MANDATE);
  const [, rerunQualification] = useMutation(RERUN_QUALIFICATION);
  const [pending, setPending] = useState<IntakeReviewAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(
    action: IntakeReviewAction,
    fn: () => Promise<{ error?: { message: string } }>,
  ): Promise<void> {
    setPending(action);
    setError(null);
    const res = await fn();
    setPending(null);
    if (res.error) setError(res.error.message);
    else router.refresh();
  }

  return {
    accept: (mandateId, leadId) => run("accept", () => acceptIntake({ id: mandateId, leadId })),
    deprioritize: (mandateId, reason) =>
      run("deprioritize", () => deprioritizeIntake({ id: mandateId, reason })),
    rerun: (mandateId) => run("rerun", () => rerunQualification({ id: mandateId })),
    pending,
    error,
  };
}
