"use client";
// The fund's own documents, in its own portal (F3.1 / F3.2, Aika's document-card
// pattern from §2c).
//
// Statuses use the vocabulary a fund understands — Not uploaded / Under review /
// Needs update / Executed — rather than the internal DocumentStatus enum, and
// there are no download links: what the fund needs to know is whether we have
// the document and what is happening to it. Viewers see the list; only Editors
// get the upload control, matching the seat model everywhere else in the portal.

import { useRef, useState } from "react";

export interface PortalDocumentRow {
  id: string;
  name: string;
  status: string | null;
  uploadedAt: string;
}

export interface PortalDocumentSlot {
  type: "InvestmentCriteria" | "NDA";
  title: string;
  description: string;
  documents: PortalDocumentRow[];
}

const STATUS_LABEL: Record<string, string> = {
  Draft: "Needs update",
  UnderReview: "Under review",
  Approved: "Approved",
  Executed: "Executed",
  Superseded: "Replaced",
};

const STATUS_TONE: Record<string, string> = {
  "Needs update": "bg-[var(--t-tag-bg-amber)] text-[var(--t-tag-text-amber)]",
  "Under review": "bg-[var(--t-tag-bg-sky)] text-[var(--t-tag-text-sky)]",
  Approved: "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]",
  Executed: "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]",
  Replaced: "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]",
  "Not uploaded": "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]",
};

function StatusChip({ label }: { label: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[label] ?? STATUS_TONE["Not uploaded"]}`}>
      {label}
    </span>
  );
}

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(iso),
  );
}

function Slot({ slot, canEdit }: { slot: PortalDocumentSlot; canEdit: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const latest = slot.documents[0] ?? null;

  async function send() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setFailed(true);
      setMessage("Choose a file first.");
      return;
    }
    setBusy(true);
    setFailed(false);
    setMessage(null);
    const data = new FormData();
    data.set("file", file);
    data.set("type", slot.type);
    try {
      const res = await fetch("/api/portal/documents", { method: "POST", body: data });
      if (res.ok) {
        setMessage("Uploaded — the Noblestride team will review it.");
        // A full reload is the honest refresh here: the list is server-rendered.
        window.location.reload();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setFailed(true);
      setMessage(body.error ?? "We couldn't save that file. Please try again.");
    } catch {
      setFailed(true);
      setMessage("We couldn't save that file. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-[var(--border-subtle)] py-4 last:border-0 last:pb-0" data-testid={`doc-slot-${slot.type}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">{slot.title}</p>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{slot.description}</p>
        </div>
        <StatusChip label={latest ? (STATUS_LABEL[latest.status ?? ""] ?? "Under review") : "Not uploaded"} />
      </div>

      {slot.documents.length > 0 && (
        <ul className="mt-3 space-y-1">
          {slot.documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="text-[var(--text-primary)]">{doc.name}</span>
              <span className="text-xs text-[var(--text-tertiary)]">
                {STATUS_LABEL[doc.status ?? ""] ?? "Under review"} · {fmt(doc.uploadedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.xlsx"
            data-testid={`doc-file-${slot.type}`}
            className="text-xs text-[var(--text-secondary)]"
          />
          <button
            type="button"
            onClick={send}
            disabled={busy}
            className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-60"
          >
            {busy ? "Uploading…" : latest ? "Replace" : "Upload"}
          </button>
          <span className="text-[11px] text-[var(--text-tertiary)]">PDF, Word or Excel, up to 15 MB.</span>
        </div>
      ) : (
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">
          A team member with edit access can upload documents.
        </p>
      )}

      {message && (
        <p
          className={
            "mt-1 text-xs " + (failed ? "text-[var(--t-tag-text-rose)]" : "text-[var(--t-tag-text-emerald)]")
          }
        >
          {message}
        </p>
      )}
    </div>
  );
}

export function PortalDocumentsCard({
  slots,
  canEdit,
}: {
  slots: PortalDocumentSlot[];
  canEdit: boolean;
}) {
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]" id="documents">
      <div className="border-b border-[var(--border-subtle)] px-5 py-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Your documents</h2>
        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
          What Noblestride has on file for your fund, and what it is waiting on.
        </p>
      </div>
      <div className="px-5 py-2">
        {slots.map((slot) => (
          <Slot key={slot.type} slot={slot} canEdit={canEdit} />
        ))}
      </div>
    </section>
  );
}
