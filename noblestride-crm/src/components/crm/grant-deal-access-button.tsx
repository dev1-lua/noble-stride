"use client";
// F6b.2 (image28): "restrict the details until the investor has expressed
// interest and been granted access."
//
// The refusal is the interesting path. When the investor has no NDA the server
// throws NdaGuardError and its message — which names the portal NDA flow — is
// shown verbatim, because that is the action staff need to take next. The
// button never gets a "force" option (decision D2).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";

const GRANT = `
  mutation GrantDealAccess($engagementId: ID!) {
    grantDealAccess(engagementId: $engagementId) { id engagementStage status }
  }
`;

export function GrantDealAccessButton({
  engagementId,
  granted,
}: {
  engagementId: string;
  granted: boolean;
}) {
  const router = useRouter();
  const [{ fetching }, grant] = useMutation(GRANT);
  const [error, setError] = useState<string | null>(null);

  if (granted) {
    return (
      <p className="text-xs text-[var(--text-tertiary)]" data-testid="deal-access-granted">
        Deal access granted — this investor is past the NDA gate.
      </p>
    );
  }

  return (
    <div>
      <button
        data-testid="grant-deal-access"
        className="rounded bg-[var(--t-tag-bg-emerald)] px-3 py-1.5 text-sm font-medium text-[var(--t-tag-text-emerald)] hover:opacity-80 disabled:opacity-50"
        disabled={fetching}
        onClick={async () => {
          setError(null);
          const res = await grant({ engagementId });
          if (res.error) setError(res.error.graphQLErrors[0]?.message ?? res.error.message);
          else router.refresh();
        }}
      >
        {fetching ? "Granting…" : "Grant deal access"}
      </button>
      {error && (
        <p className="mt-1 max-w-md text-xs text-rose-600" data-testid="grant-deal-access-error">
          {error}
        </p>
      )}
      {!error && (
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Moves the engagement to NDA Signed, which unmasks the deal in the investor&apos;s portal. Requires a signed
          NDA.
        </p>
      )}
    </div>
  );
}
