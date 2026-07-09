"use client";

// contact-form.tsx — account request for an email that already matches an
// existing investor contact (real-auth spec §10). Password-only: the contact
// record already exists, so no fund details are re-collected.

import { useActionState } from "react";
import { PasswordInput } from "@/components/ui";
import type { WizardActionState } from "./actions";

const inputClass =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] " +
  "disabled:cursor-not-allowed disabled:opacity-70";

const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";

export default function ContactForm({
  email,
  action,
}: {
  email: string;
  action: (prev: WizardActionState, formData: FormData) => Promise<WizardActionState>;
}) {
  const [state, submitAction, isPending] = useActionState(action, {});

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
      <p className="mb-4 text-sm text-[var(--text-tertiary)]">
        We found an existing investor contact for <strong>{email}</strong>. Set a password to request
        account access.
      </p>

      {state.error && (
        <div className="mb-4 rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-3 text-sm text-[var(--t-tag-text-rose)]">
          {state.error}
        </div>
      )}

      <form action={submitAction} className="space-y-4">
        <input type="hidden" name="email" value={email} />
        <div>
          <label htmlFor="password" className={labelClass}>
            Password <span className="text-rose-500">*</span>
          </label>
          <PasswordInput
            id="password"
            name="password"
            required
            minLength={10}
            placeholder="At least 10 characters"
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="confirm" className={labelClass}>
            Confirm password <span className="text-rose-500">*</span>
          </label>
          <PasswordInput
            id="confirm"
            name="confirm"
            required
            minLength={10}
            placeholder="Re-enter your password"
            className="mt-1"
          />
        </div>
        <div className="flex items-center justify-end border-t border-[var(--border-subtle)] pt-4">
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            {isPending ? "Submitting…" : "Request account"}
          </button>
        </div>
      </form>
    </section>
  );
}
