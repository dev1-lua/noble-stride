"use client";
// Record NDA buttons — manual recording only (SOW §06: no automatic signing).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";

const RECORD_OPEN = `
  mutation RecordOpenNda($investorId: ID!) {
    recordOpenNda(investorId: $investorId) { id ndaStatus openNdaSignedAt }
  }
`;
const RECORD_CLOSED = `
  mutation RecordClosedNda($engagementId: ID!) {
    recordClosedNda(engagementId: $engagementId) { id ndaType ndaSignedAt }
  }
`;

export function RecordOpenNdaButton({ investorId }: { investorId: string }) {
  const router = useRouter();
  const [{ fetching }, record] = useMutation(RECORD_OPEN);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
        disabled={fetching}
        onClick={async () => {
          const res = await record({ investorId });
          if (res.error) setError(res.error.message);
          else router.refresh();
        }}
      >
        {fetching ? "Recording…" : "Record Open NDA"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function RecordClosedNdaButton({ engagementId }: { engagementId: string }) {
  const router = useRouter();
  const [{ fetching }, record] = useMutation(RECORD_CLOSED);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        disabled={fetching}
        onClick={async () => {
          const res = await record({ engagementId });
          if (res.error) setError(res.error.message);
          else router.refresh();
        }}
      >
        {fetching ? "Recording…" : "Record Closed NDA"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
