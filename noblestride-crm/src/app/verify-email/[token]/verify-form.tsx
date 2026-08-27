"use client";

import { useActionState } from "react";
import Link from "next/link";
import { confirmEmailChangeAction, type VerifyEmailState } from "../actions";

const initial: VerifyEmailState = {};

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, submitAction, isPending] = useActionState(confirmEmailChangeAction, initial);
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
      {state.error && (
        <div className="mb-4 rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-3 text-sm text-[var(--t-tag-text-rose)]">
          {state.error}
        </div>
      )}
      <form action={submitAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          disabled={isPending}
          data-testid="confirm-email-change"
          className="w-full rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
        >
          {isPending ? "Confirming…" : "Confirm this change"}
        </button>
      </form>
      <div className="mt-4 border-t border-[var(--border-subtle)] pt-4 text-xs">
        <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
          ← Back to sign in
        </Link>
      </div>
    </section>
  );
}
