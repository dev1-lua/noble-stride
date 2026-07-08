"use client";
// Send-for-e-signature button (Task 7). Rendered ONLY by a server parent that
// has already checked isConfigured("docusign") AND resolved a signer email —
// see src/app/(crm)/investors/[id]/page.tsx and src/app/(crm)/engagement/[id]/page.tsx.
// Mirrors the manual RecordOpenNdaButton/RecordClosedNdaButton pattern in
// nda-actions.tsx: raw urql mutation string, router.refresh() on success.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";

const SEND = `
  mutation SendEsign($input: SendEsignInput!) {
    sendEsignEnvelope(input: $input) { id externalId status }
  }
`;

// Minimal one-page valid PDF, base64-encoded — placeholder envelope document
// until a stored NDA/term-sheet template source exists per kind (spec §4).
// Swap fetchTemplateBase64() for a real per-kind template lookup when
// documents ship (kept as a standalone async function so that swap is a
// one-line change at the call site).
const PLACEHOLDER_PDF_BASE64 =
  "JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDIgMCBSPj4KZW5kb2JqCjIgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzWzMgMCBSXS9Db3VudCAxPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNjEyIDc5Ml0+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTIgMDAwMDAgbiAKMDAwMDAwMDEwMSAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNC9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjE3OAolJUVPRgo=";

async function fetchTemplateBase64(): Promise<string> {
  return PLACEHOLDER_PDF_BASE64;
}

export function SendEsignButton(props: {
  kind: "OpenNda" | "ClosedNda" | "TermSheet";
  subject: string;
  signerEmail: string;
  signerName: string;
  investorId?: string;
  engagementId?: string;
  transactionId?: string;
}) {
  const router = useRouter();
  const [{ fetching }, send] = useMutation(SEND);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        className="rounded bg-[var(--t-tag-bg-violet)] px-3 py-1.5 text-sm font-medium text-[var(--t-tag-text-violet)] hover:opacity-80 disabled:opacity-50"
        disabled={fetching}
        onClick={async () => {
          const documentBase64 = await fetchTemplateBase64();
          const res = await send({
            input: {
              kind: props.kind,
              documentBase64,
              documentName: `${props.kind}.pdf`,
              signerEmail: props.signerEmail,
              signerName: props.signerName,
              subject: props.subject,
              investorId: props.investorId,
              engagementId: props.engagementId,
              transactionId: props.transactionId,
            },
          });
          if (res.error) setError(res.error.message);
          else router.refresh();
        }}
      >
        {fetching ? "Sending…" : "Send for e-signature"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
