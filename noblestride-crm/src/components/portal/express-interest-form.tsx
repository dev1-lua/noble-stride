"use client";
// Per-card "register your interest" (F6b.1 / image27: "the investor should see
// all the deals … and be able to generate interest, which notifies the deal
// lead").
//
// Deliberately a sibling of the card's <Link>, never a child: a form inside an
// anchor is invalid and swallows clicks. The optional note goes into the same
// conversation thread the deal page uses, so staff see one conversation.

import { useState } from "react";
import { expressInterest } from "@/app/portal/investor/deals/[id]/actions";

export function ExpressInterestForm({
  dealId,
  returnTo,
  registered,
}: {
  dealId: string;
  returnTo: string;
  registered: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (registered) {
    return (
      <p className="mt-3 text-xs text-[var(--text-tertiary)]" data-testid={`interest-registered-${dealId}`}>
        Interest registered — Noblestride will come back to you.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={`open-express-interest-${dealId}`}
        className="mt-3 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]"
      >
        Express interest
      </button>
    );
  }

  return (
    <form action={expressInterest} className="mt-3 space-y-2">
      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <textarea
        name="message"
        rows={2}
        placeholder="Anything you would like us to know? (optional)"
        data-testid={`interest-message-${dealId}`}
        className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          data-testid={`express-interest-${dealId}`}
          className="rounded bg-[var(--t-tag-bg-emerald)] px-2.5 py-1 text-xs font-medium text-[var(--t-tag-text-emerald)] hover:opacity-80"
        >
          Send
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
