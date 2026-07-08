"use client";
// Approve / Reject / Greylist actions for a pending investor registration.
// Greylist = dedicated greylistInvestor mutation: sets engagementClassification
// "Greylisted" (zero visibility everywhere, SOW §06/§11.2) AND resolves the
// registration as Rejected so it leaves the pending queue.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";

const SET_STATUS = `
  mutation SetOnboarding($id: ID!, $status: OnboardingStatus!) {
    setInvestorOnboardingStatus(id: $id, status: $status) { id onboardingStatus }
  }
`;
const GREYLIST = `
  mutation Greylist($id: ID!) {
    greylistInvestor(id: $id) { id onboardingStatus engagementClassification }
  }
`;

export function OnboardingActions({ investorId }: { investorId: string }) {
  const router = useRouter();
  const [, setStatus] = useMutation(SET_STATUS);
  const [, greylist] = useMutation(GREYLIST);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<{ error?: { message: string } }>) {
    setPending(label);
    setError(null);
    const res = await fn();
    setPending(null);
    if (res.error) setError(res.error.message);
    else router.refresh();
  }

  const btn = "rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50";
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          className={`${btn} bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]`}
          disabled={pending !== null}
          onClick={() => run("approve", () => setStatus({ id: investorId, status: "Approved" }))}
        >
          {pending === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          className={`${btn} bg-rose-600 text-white hover:bg-rose-700`}
          disabled={pending !== null}
          onClick={() => run("reject", () => setStatus({ id: investorId, status: "Rejected" }))}
        >
          {pending === "reject" ? "Rejecting…" : "Reject"}
        </button>
        <button
          className={`${btn} border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]`}
          disabled={pending !== null}
          onClick={() => run("greylist", () => greylist({ id: investorId }))}
        >
          {pending === "greylist" ? "…" : "Greylist"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
