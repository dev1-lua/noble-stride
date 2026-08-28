"use client";
// "Upload your own NDA" (F3.2, second half of image7).
//
// Two steps behind one button: the file goes to /api/portal/documents (which
// files it Internal/UnderReview and alerts staff), then the returned document
// id is put forward for sign-off through submitOwnNdaAction. The upload route
// answers with status codes rather than redirects, which is why this is a
// client island rather than a plain form action.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitOwnNdaAction } from "./actions";

export function OwnNdaCard({ canEdit }: { canEdit: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function send() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setFailed(true);
      setMessage("Choose your NDA file first.");
      return;
    }
    setBusy(true);
    setFailed(false);
    setMessage(null);
    const data = new FormData();
    data.set("file", file);
    data.set("type", "NDA");
    try {
      const res = await fetch("/api/portal/documents", { method: "POST", body: data });
      const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !body.id) {
        setFailed(true);
        setMessage(body.error ?? "We couldn't save that file. Please try again.");
        return;
      }
      const fd = new FormData();
      fd.set("documentId", body.id);
      await submitOwnNdaAction(fd);
      router.refresh();
    } catch {
      setFailed(true);
      setMessage("We couldn't save that file. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return (
      <p className="text-xs text-[var(--text-tertiary)]">
        A team member with edit access can upload your fund&apos;s NDA.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          data-testid="own-nda-file"
          className="text-xs text-[var(--text-secondary)]"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy}
          data-testid="own-nda-submit"
          className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-60"
        >
          {busy ? "Uploading…" : "Send for sign-off"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">PDF or Word, up to 15 MB.</p>
      {message && (
        <p className={"mt-1 text-xs " + (failed ? "text-[var(--t-tag-text-rose)]" : "text-[var(--t-tag-text-emerald)]")}>
          {message}
        </p>
      )}
    </div>
  );
}
