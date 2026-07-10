"use client";
// Share-via-Box button (Task 12b). Rendered ONLY by a server parent that has
// already checked isConfigured("box") — see src/app/(crm)/documents/page.tsx.
// Mirrors the SendEsignButton pattern in send-esign-button.tsx: raw urql
// mutation string, router.refresh() on success.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";

const SHARE = `
  mutation ShareDocumentViaBox($documentId: ID!) {
    shareDocumentViaBox(documentId: $documentId)
  }
`;

export function ShareBoxButton(props: { documentId: string }) {
  const router = useRouter();
  const [{ fetching }, share] = useMutation(SHARE);
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button
        className="rounded bg-[var(--t-tag-bg-blue)] px-2 py-1 text-xs font-medium text-[var(--t-tag-text-blue)] hover:opacity-80 disabled:opacity-50"
        disabled={fetching}
        onClick={async () => {
          setError(null);
          const res = await share({ documentId: props.documentId });
          if (res.error) setError(res.error.message);
          else router.refresh();
        }}
      >
        {fetching ? "Sharing…" : "Share via Box"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </span>
  );
}
