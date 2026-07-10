// reset-password/[token]/page.tsx — set a new password from a reset link
// (real-auth spec §10). The token travels as a route param and a hidden
// form field; errors round-trip via query params, same pattern as login.

import Link from "next/link";
import { PasswordInput } from "@/components/ui";
import { resetPasswordAction } from "../actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}

const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";

// Fixed allow-list for the ?error slug. Never render the raw query value —
// unknown slugs collapse to a generic line (anti content-spoofing).
const RESET_ERRORS: Record<string, string> = {
  mismatch: "Passwords do not match.",
  invalid: "This reset link is invalid or has expired. Request a new one.",
  weak: "Password must be at least 10 characters and not easily guessable.",
};

export default async function ResetPasswordPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const sp = await searchParams;
  const errorText = sp.error ? RESET_ERRORS[sp.error] ?? "Reset failed. Request a new link." : null;

  return (
    <div className="flex min-h-screen items-start justify-center bg-[var(--bg-secondary)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold tracking-tight text-emerald-950">
            NobleStride Capital
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">Set a new password</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">Choose a new password for your account.</p>
        </div>

        {errorText && (
          <div className="rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-4 text-sm text-[var(--t-tag-text-rose)]">
            {errorText}
          </div>
        )}

        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
          <form action={resetPasswordAction} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            <div>
              <label htmlFor="password" className={labelClass}>
                New password <span className="text-rose-500">*</span>
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
                placeholder="Re-enter your new password"
                className="mt-1"
              />
            </div>
            <div className="flex items-center justify-end border-t border-[var(--border-subtle)] pt-4">
              <button
                type="submit"
                className="rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                Set new password
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
