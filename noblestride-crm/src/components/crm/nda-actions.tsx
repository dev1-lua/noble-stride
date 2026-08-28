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
        className="rounded bg-[var(--t-tag-bg-sky)] px-3 py-1.5 text-sm font-medium text-[var(--t-tag-text-sky)] hover:opacity-80 disabled:opacity-50"
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
        className="rounded bg-[var(--t-tag-bg-emerald)] px-3 py-1.5 text-sm font-medium text-[var(--t-tag-text-emerald)] hover:opacity-80 disabled:opacity-50"
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

// ── F3.2: the staff half of the self-service NDA flows ──────────────────────

const REQUEST_NDA = `
  mutation RequestNdaSignature($investorId: ID!) {
    requestNdaSignature(investorId: $investorId) { id ndaStatus }
  }
`;
const COUNTERSIGN = `
  mutation CountersignUploadedNda($documentId: ID!) {
    countersignUploadedNda(documentId: $documentId) { id status }
  }
`;

/**
 * Ask the fund to sign the standard NDA in its portal. Records a note and
 * raises one portal notification — it never changes NDA state, so it is safe
 * to press twice.
 */
export function SendStandardNdaButton({ investorId }: { investorId: string }) {
  const router = useRouter();
  const [{ fetching }, request] = useMutation(REQUEST_NDA);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  return (
    <div>
      <button
        data-testid="send-standard-nda"
        className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
        disabled={fetching}
        onClick={async () => {
          const res = await request({ investorId });
          if (res.error) setError(res.error.message);
          else {
            setSent(true);
            router.refresh();
          }
        }}
      >
        {fetching ? "Sending…" : sent ? "NDA requested" : "Send standard NDA"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

/** Accept a fund's own NDA paper: the document becomes Executed and the Open NDA applies. */
export function CountersignNdaButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [{ fetching }, countersign] = useMutation(COUNTERSIGN);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        data-testid="countersign-nda"
        className="rounded bg-[var(--t-tag-bg-emerald)] px-2.5 py-1 text-xs font-medium text-[var(--t-tag-text-emerald)] hover:opacity-80 disabled:opacity-50"
        disabled={fetching}
        onClick={async () => {
          const res = await countersign({ documentId });
          if (res.error) setError(res.error.message);
          else router.refresh();
        }}
      >
        {fetching ? "Recording…" : "Mark countersigned"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
