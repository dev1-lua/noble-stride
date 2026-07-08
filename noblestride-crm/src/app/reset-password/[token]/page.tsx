// reset-password/[token]/page.tsx — set a new password from a reset link
// (real-auth spec §10). The token travels as a route param and a hidden
// form field; errors round-trip via query params, same pattern as login.

import Link from "next/link";
import { resetPasswordAction } from "../actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}

const inputClass =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";

export default async function ResetPasswordPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const sp = await searchParams;

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

        {sp.error && (
          <div className="rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-4 text-sm text-[var(--t-tag-text-rose)]">
            {sp.error}
          </div>
        )}

        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
          <form action={resetPasswordAction} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            <div>
              <label htmlFor="password" className={labelClass}>
                New password <span className="text-rose-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={10}
                placeholder="At least 10 characters"
                className={"mt-1 " + inputClass}
              />
            </div>
            <div>
              <label htmlFor="confirm" className={labelClass}>
                Confirm password <span className="text-rose-500">*</span>
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                required
                minLength={10}
                placeholder="Re-enter your new password"
                className={"mt-1 " + inputClass}
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
