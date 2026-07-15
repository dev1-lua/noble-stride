// forgot-password/page.tsx — request a password reset link (real-auth spec
// §10). Always shows the same confirmation regardless of whether the email
// exists — no enumeration.

import Link from "next/link";
import { forgotPasswordAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ sent?: string }>;
}

const inputClass =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const sent = Boolean(sp.sent);

  return (
    <div className="flex min-h-screen items-start justify-center bg-[var(--bg-secondary)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold tracking-tight text-emerald-950">
            Noblestride Capital
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">Reset your password</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">We&apos;ll send a reset link to your email.</p>
        </div>

        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-primary)]">
                If an account exists for that address, a reset link has been sent.
              </p>
              <Link href="/login" className="text-xs font-medium text-[var(--accent)] hover:underline">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <form action={forgotPasswordAction} className="space-y-4">
              <div>
                <label htmlFor="email" className={labelClass}>
                  Email <span className="text-rose-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@fund.com"
                  className={"mt-1 " + inputClass}
                />
              </div>
              <div className="flex items-center justify-end border-t border-[var(--border-subtle)] pt-4">
                <button
                  type="submit"
                  className="rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
                >
                  Send reset link
                </button>
              </div>
              <div className="mt-4 border-t border-[var(--border-subtle)] pt-4 text-xs">
                <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
                  ← Back to sign in
                </Link>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
