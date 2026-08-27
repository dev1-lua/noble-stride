"use client";

// The search box for the applications queue. A plain GET form, so the tab and
// query both live in the URL and the page stays a server component.

import { useRef } from "react";

export function ApplicationsToolbar({ tab, q }: { tab: string; q: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} method="get" action="/applications" className="flex items-center gap-2">
      <input type="hidden" name="tab" value={tab} />
      <input
        name="q"
        defaultValue={q}
        placeholder="Search company, contact or email…"
        aria-label="Search applications"
        data-testid="applications-search"
        className="w-64 rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
      />
      <button
        type="submit"
        className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]"
      >
        Search
      </button>
      {q && (
        <a
          href={`/applications?tab=${tab}`}
          className="text-xs font-medium text-[var(--accent)] hover:underline"
        >
          Clear
        </a>
      )}
    </form>
  );
}
