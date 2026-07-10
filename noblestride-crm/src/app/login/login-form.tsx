"use client";

import { useActionState } from "react";
import Link from "next/link";
import { PasswordInput } from "@/components/ui";
import { loginAction, type LoginFormState } from "./actions";

const inputClass =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";

const initial: LoginFormState = {};

export function LoginForm({ isInvestor, next }: { isInvestor: boolean; next?: string }) {
  const [state, submitAction, isPending] = useActionState(loginAction, initial);
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
      {state.error && (
        <div className="mb-4 rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-3 text-sm text-[var(--t-tag-text-rose)]">
          {state.error}
        </div>
      )}
      <form action={submitAction} className="space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div>
          <label htmlFor="email" className={labelClass}>
            Email <span className="text-rose-500">*</span>
          </label>
          <input
            id="email" name="email" type="email" required autoComplete="username"
            defaultValue={state.email ?? ""} placeholder="name@fund.com"
            className={"mt-1 " + inputClass}
          />
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>
            Password <span className="text-rose-500">*</span>
          </label>
          <PasswordInput
            id="password" name="password" required autoComplete="current-password"
            placeholder="Your password" className="mt-1"
          />
        </div>
        <div className={"flex items-center gap-4 border-t border-[var(--border-subtle)] pt-4 " + (isInvestor ? "justify-between" : "justify-end")}>
          {isInvestor && (
            <Link href="/register" className="text-xs font-medium text-[var(--accent)] hover:underline">
              New here? Register your fund →
            </Link>
          )}
          <button type="submit" disabled={isPending}
            className="rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60">
            {isPending ? "Signing in…" : "Sign in"}
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4 text-xs">
          <Link href="/forgot-password" className="font-medium text-[var(--accent)] hover:underline">Forgot password?</Link>
          <Link href="/register" className="font-medium text-[var(--accent)] hover:underline">Create an account →</Link>
        </div>
      </form>
    </section>
  );
}
