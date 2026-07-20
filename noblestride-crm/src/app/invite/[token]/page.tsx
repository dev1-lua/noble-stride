// invite/[token]/page.tsx — team-member share-link landing (spec 2026-07-19
// §5.3/§6). The page greets with the inviting fund's name, but access only
// proceeds when the entered email matches the one bound to the token
// server-side. Invalid/expired/revoked links get a neutral card that reveals
// nothing. Copy is contractual (spec §6) — keep it verbatim.

import Link from "next/link";
import { PasswordInput } from "@/components/ui";
import { peekInviteToken } from "@/server/auth/team-invites";
import { redeemInviteAction } from "../actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}

const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";
const inputClass =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

// Fixed allow-list — never render the raw query value (anti content-spoofing).
const INVITE_ERRORS: Record<string, string> = {
  email: "No invitation found for this email.",
  mismatch: "Passwords do not match.",
  weak: "Password must be at least 10 characters and not easily guessable.",
  invalid: "This invite link is invalid or has expired. Ask your colleague to send a fresh one.",
  pending: "Your organization's registration is still under review.",
  "rate-limited": "Too many attempts — try again in a little while.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-[var(--bg-secondary)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold tracking-tight text-emerald-950">
            Noblestride Capital
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

export default async function InvitePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const sp = await searchParams;
  const errorText = sp.error ? INVITE_ERRORS[sp.error] ?? "Something went wrong. Try again." : null;

  const peek = await peekInviteToken(token);

  if (!peek) {
    return (
      <Shell>
        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-6 text-center">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">This invite link isn&apos;t valid</h1>
          <p className="mt-2 text-sm text-[var(--text-tertiary)]">
            The link may have expired or been replaced. Ask your colleague to send a fresh one from
            their Team page.
          </p>
          <Link href="/login" className="mt-4 inline-block text-sm font-medium text-[var(--accent)] hover:underline">
            Go to sign in
          </Link>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {peek.investorName} has invited you to their Noblestride workspace
        </h1>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">
          Use this access to stay on top of what&apos;s happening on {peek.investorName}&apos;s end —
          the deals they&apos;ve been shown, teasers shared with them, and the live status of every
          ongoing engagement. Verify your email below to set up your access.
        </p>
      </div>

      {errorText && (
        <div className="rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-4 text-sm text-[var(--t-tag-text-rose)]">
          {errorText}
        </div>
      )}

      {!peek.orgApproved ? (
        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-6 text-center">
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            Your organization&apos;s registration is still under review.
          </p>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            You&apos;ll be able to set up access once the Noblestride team approves it — keep this
            link handy.
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
          <form action={redeemInviteAction} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            <div>
              <label htmlFor="email" className={labelClass}>
                Your work email <span className="text-rose-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="name@yourfund.com"
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label htmlFor="password" className={labelClass}>
                Create a password <span className="text-rose-500">*</span>
              </label>
              <PasswordInput id="password" name="password" required minLength={10} placeholder="At least 10 characters" className="mt-1" />
            </div>
            <div>
              <label htmlFor="confirm" className={labelClass}>
                Confirm password <span className="text-rose-500">*</span>
              </label>
              <PasswordInput id="confirm" name="confirm" required minLength={10} placeholder="Re-enter your password" className="mt-1" />
            </div>
            <div className="flex items-center justify-end border-t border-[var(--border-subtle)] pt-4">
              <button
                type="submit"
                className="rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                Set up my access
              </button>
            </div>
          </form>
        </section>
      )}
    </Shell>
  );
}
