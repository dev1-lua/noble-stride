"use client";

// internal-form.tsx — Noblestride staff signup (real-auth spec §10). A
// @noblestride.capital email routes here from the email-first fork in
// page.tsx; internalSignupAction either activates the account immediately
// (directory match) or files it for admin approval.

import { useActionState } from "react";
import { PasswordInput } from "@/components/ui";
import { internalSignupAction } from "./actions";

const inputClass =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] " +
  "disabled:cursor-not-allowed disabled:opacity-70";

const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";

export default function InternalForm({ email }: { email: string }) {
  const [state, submitAction, isPending] = useActionState(internalSignupAction, {});

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
      <p className="mb-4 text-sm text-[var(--text-tertiary)]">
        Request a Noblestride staff account. Requests for emails already in the team directory are
        activated immediately; others are reviewed by an administrator.
      </p>

      {state.error && (
        <div className="mb-4 rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-3 text-sm text-[var(--t-tag-text-rose)]">
          {state.error}
        </div>
      )}

      <form action={submitAction} className="space-y-4">
        <div>
          <label htmlFor="name" className={labelClass}>
            Name <span className="text-rose-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Full name"
            className={"mt-1 " + inputClass}
          />
        </div>
        <div>
          <label htmlFor="jobTitle" className={labelClass}>
            Job title
          </label>
          <input
            id="jobTitle"
            name="jobTitle"
            type="text"
            placeholder="e.g. Associate"
            className={"mt-1 " + inputClass}
          />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            readOnly
            value={email}
            className={"mt-1 " + inputClass}
          />
        </div>
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
