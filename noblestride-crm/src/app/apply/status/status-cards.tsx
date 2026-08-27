"use client";
// The applicant's view of their own application(s) (F2.4 / image25).
//
// What an applicant may see is decided server-side by
// listApplicationsForEmail's allow-list; this component only lays it out. Two
// things it deliberately does NOT show: any download link for a document (the
// projection carries no URL), and who the interested investors are — only how
// many, which is the Aika pattern.

import { useState } from "react";
import type { ApplicantApplication } from "@/server/services/applicant-status";

const STATUS_TONE: Record<ApplicantApplication["status"], string> = {
  "Awaiting review": "bg-[var(--t-tag-bg-amber)] text-[var(--t-tag-text-amber)]",
  "Accepted / In progress": "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]",
  "Not taken forward": "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]",
};

const DOC_STATUS_LABEL: Record<string, string> = {
  Draft: "Draft",
  UnderReview: "Under review",
  Approved: "Approved",
  Executed: "Executed",
  Superseded: "Replaced",
};

function fmt(d: Date | string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    typeof d === "string" ? new Date(d) : d,
  );
}

function UploadForm({ clientId, company }: { clientId: string; company: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setState("sending");
    setMessage(null);
    try {
      // Same path scope as the applicant cookie — see the route's header.
      const res = await fetch("/apply/status/upload", { method: "POST", body: data });
      if (res.ok) {
        setState("done");
        setMessage("Received — the Noblestride team will review it.");
        form.reset();
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setState("error");
        setMessage(body.error ?? "We couldn't save that file. Please try again.");
      }
    } catch {
      setState("error");
      setMessage("We couldn't save that file. Please try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 border-t border-[var(--border-subtle)] pt-3" data-testid="applicant-upload">
      <input type="hidden" name="clientId" value={clientId} />
      <label className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
        Add a document for {company}
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="file"
          required
          accept=".pdf,.docx,.xlsx"
          className="text-xs text-[var(--text-secondary)]"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
        >
          {state === "sending" ? "Uploading…" : "Upload"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">PDF, Word or Excel, up to 15 MB.</p>
      {message && (
        <p
          className={
            "mt-1 text-xs " +
            (state === "error" ? "text-[var(--t-tag-text-rose)]" : "text-[var(--t-tag-text-emerald)]")
          }
        >
          {message}
        </p>
      )}
    </form>
  );
}

export function StatusCards({ applications }: { applications: ApplicantApplication[] }) {
  if (applications.length === 0) {
    return (
      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-6 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          We don&apos;t have an application under this email address.
        </p>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          If you applied with a different address, sign out and try that one.
        </p>
        <a
          href="/intake"
          className="mt-4 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
        >
          Start an application →
        </a>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {applications.map((app) => (
        <section
          key={app.mandateId}
          data-testid="applicant-application"
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{app.company}</h2>
              <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                Submitted {fmt(app.submittedAt)}
              </p>
            </div>
            <span
              data-testid="applicant-status-chip"
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[app.status]}`}
            >
              {app.status}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                Contact on file
              </dt>
              <dd className="mt-0.5 text-[var(--text-primary)]">
                {app.contactName || "—"}
                <span className="text-[var(--text-tertiary)]"> · {app.contactEmail}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                Where it stands
              </dt>
              <dd className="mt-0.5 text-[var(--text-primary)]">{app.statusDetail}</dd>
            </div>
          </dl>

          {app.interestCount > 0 && (
            <p
              className="mt-3 rounded border border-[var(--border-subtle)] bg-[var(--t-tag-bg-emerald)] px-3 py-2 text-xs font-medium text-[var(--t-tag-text-emerald)]"
              data-testid="applicant-interest"
            >
              {app.interestCount} investor{app.interestCount === 1 ? " has" : "s have"} registered
              interest. Your Noblestride contact will discuss them with you.
            </p>
          )}

          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
              Documents on file
            </p>
            {app.documents.length === 0 ? (
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">Nothing uploaded yet.</p>
            ) : (
              <ul className="mt-1 space-y-1" data-testid="applicant-documents">
                {app.documents.map((doc, i) => (
                  <li key={`${doc.name}-${i}`} className="flex flex-wrap items-baseline gap-2 text-sm">
                    <span className="text-[var(--text-primary)]">{doc.name}</span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {doc.typeLabel}
                      {doc.status ? ` · ${DOC_STATUS_LABEL[doc.status] ?? doc.status}` : ""} ·{" "}
                      {fmt(doc.uploadedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <UploadForm clientId={app.clientId} company={app.company} />
        </section>
      ))}
    </div>
  );
}
