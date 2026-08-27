// partner-claim-form.tsx — the Partner card's destination (F1.1 / F5.6).
//
// Two panes, because a partner arrives in one of two states: they were invited
// by Noblestride and have a link, or they have not been invited yet. Neither
// pane reveals whether an email, firm or token exists — the first hands off to
// the real /invite gate, the second always ends on the same confirmation.

import Link from "next/link";
import { claimPartnerInviteAction, requestPartnerAccessAction } from "./actions";

const inputClass =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";
const submitClass =
  "rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]";

export default function PartnerClaimForm() {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          I have an invitation from Noblestride
        </h2>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Paste the invitation link from your email — or just the code at the end of it.
        </p>
        <form action={claimPartnerInviteAction} className="mt-4 space-y-4" data-testid="partner-claim-form">
          <div>
            <label htmlFor="token" className={labelClass}>
              Invitation link or code <span className="text-rose-500">*</span>
            </label>
            <input
              id="token"
              name="token"
              required
              placeholder="https://…/invite/abc123…"
              className={"mt-1 font-mono text-xs " + inputClass}
            />
          </div>
          <div className="flex justify-end border-t border-[var(--border-subtle)] pt-4">
            <button type="submit" className={submitClass}>
              Continue →
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          I haven&apos;t been invited yet
        </h2>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Tell us who you are and we&apos;ll be in touch. Partner access is granted by the
          Noblestride team.
        </p>
        <form action={requestPartnerAccessAction} className="mt-4 space-y-4" data-testid="partner-request-form">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pr-name" className={labelClass}>
                Your name <span className="text-rose-500">*</span>
              </label>
              <input id="pr-name" name="name" required className={"mt-1 " + inputClass} />
            </div>
            <div>
              <label htmlFor="pr-org" className={labelClass}>
                Organisation <span className="text-rose-500">*</span>
              </label>
              <input id="pr-org" name="organisation" required className={"mt-1 " + inputClass} />
            </div>
            <div>
              <label htmlFor="pr-email" className={labelClass}>
                Work email <span className="text-rose-500">*</span>
              </label>
              <input
                id="pr-email"
                name="email"
                type="email"
                required
                placeholder="name@firm.com"
                className={"mt-1 " + inputClass}
              />
            </div>
            <div>
              <label htmlFor="pr-phone" className={labelClass}>Phone</label>
              <input id="pr-phone" name="phone" className={"mt-1 " + inputClass} />
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
            <Link href="/register" className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)]">
              ← Choose a different role
            </Link>
            <button type="submit" className={submitClass}>
              Request access →
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
