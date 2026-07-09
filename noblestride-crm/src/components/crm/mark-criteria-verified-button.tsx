"use client";
// Mark Investor Criteria Verified button — resets criteriaVerifiedAt to now so
// the AI match ranking (see domain/ranking.ts isCriteriaStale) stops treating
// this investor's matching criteria as stale.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";

const MARK_CRITERIA_VERIFIED = `
  mutation MarkInvestorCriteriaVerified($id: ID!) {
    markInvestorCriteriaVerified(id: $id) { id criteriaVerifiedAt }
  }
`;

export function MarkCriteriaVerifiedButton({ investorId }: { investorId: string }) {
  const router = useRouter();
  const [{ fetching }, markVerified] = useMutation(MARK_CRITERIA_VERIFIED);
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button
        className="rounded bg-[var(--t-tag-bg-sky)] px-2 py-0.5 text-xs font-medium text-[var(--t-tag-text-sky)] hover:opacity-80 disabled:opacity-50"
        disabled={fetching}
        onClick={async () => {
          const res = await markVerified({ id: investorId });
          if (res.error) setError(res.error.message);
          else router.refresh();
        }}
      >
        {fetching ? "Marking…" : "Mark verified today"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </span>
  );
}
