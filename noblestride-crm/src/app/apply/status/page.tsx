// apply/status/page.tsx — public application tracking (F2.4 / §2b G1).
//
// Three steps behind one URL: enter your email, enter the code, see your
// application. Which step renders is decided by the signed cookie, not by the
// query string, so ?step= can never skip verification.

import Link from "next/link";
import { cookies } from "next/headers";
import {
  verifyApplicantToken,
  listApplicationsForEmail,
  APPLICANT_SESSION_COOKIE,
} from "@/server/services/applicant-status";
import { requestCodeAction, verifyCodeAction, signOutApplicantAction } from "./actions";
import { applyStatusNotice, applyStatusError } from "./messages";
import { StatusCards } from "./status-cards";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ step?: string; notice?: string; error?: string; email?: string }>;
}

const inputClass =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";
const submitClass =
  "rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]";

export default async function ApplyStatusPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const notice = applyStatusNotice(sp.notice);
  const error = applyStatusError(sp.error);

  const token = (await cookies()).get(APPLICANT_SESSION_COOKIE)?.value;
  const session = token ? await verifyApplicantToken(token) : null;
  const applications = session ? await listApplicationsForEmail(session.email) : [];

  // The email is carried between step 1 and step 2 so the applicant does not
  // retype it. It is only ever placed in a form value, never rendered as copy.
  const carriedEmail = typeof sp.email === "string" ? sp.email : "";

  return (
    <div className="flex min-h-screen items-start justify-center bg-[var(--bg-secondary)] px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold tracking-tight text-emerald-950">
            Noblestride Capital
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">Track your application</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            {session
              ? "What we have on file, and where your application stands."
              : "Enter the email you applied with and we'll send you a 6-digit code."}
          </p>
        </div>

        {notice && (
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
            {notice}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-4 text-sm text-[var(--t-tag-text-rose)]">
            {error}
          </div>
        )}

        {session ? (
          <>
            <StatusCards applications={applications} />
            <form action={signOutApplicantAction} className="text-center">
              <button
                type="submit"
                className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)]"
              >
                Sign out of application tracking
              </button>
            </form>
          </>
        ) : sp.step === "code" ? (
          <section className="mx-auto w-full max-w-md rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
            <form action={verifyCodeAction} className="space-y-4" data-testid="applicant-code-form">
              <input type="hidden" name="email" value={carriedEmail} />
              <div>
                <label htmlFor="code" className={labelClass}>
                  6-digit code <span className="text-rose-500">*</span>
                </label>
                <input
                  id="code"
                  name="code"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  placeholder="123456"
                  className={"mt-1 font-mono tracking-widest " + inputClass}
                />
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
                <Link href="/apply/status" className="text-xs font-medium text-[var(--accent)] hover:underline">
                  Use a different email
                </Link>
                <button type="submit" className={submitClass}>
                  Continue →
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="mx-auto w-full max-w-md rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
            <form action={requestCodeAction} className="space-y-4" data-testid="applicant-email-form">
              <div>
                <label htmlFor="email" className={labelClass}>
                  Email you applied with <span className="text-rose-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  defaultValue={carriedEmail}
                  placeholder="name@company.com"
                  className={"mt-1 " + inputClass}
                />
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
                <Link href="/intake" className="text-xs font-medium text-[var(--accent)] hover:underline">
                  Haven&apos;t applied yet?
                </Link>
                <button type="submit" className={submitClass}>
                  Send me a code →
                </button>
              </div>
            </form>
          </section>
        )}

        <p className="text-center text-xs text-[var(--text-tertiary)]">
          Questions? Reply to your Noblestride email — we never ask for payment details here.
        </p>
      </div>
    </div>
  );
}
