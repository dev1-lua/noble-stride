// login/verify/page.tsx — investor 2FA code entry (real-auth spec §10a).
// Authorized solely by the signed ns_2fa_pending cookie; no session exists yet.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PENDING_COOKIE, verifyPending } from "@/server/auth/two-factor";
import { safeNext } from "../safe-next";
import { resendLoginOtpAction, verifyLoginOtpAction } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "That code is incorrect. Check your email and try again.",
  cooldown: "Please wait a minute before requesting another code.",
  "send-failed": "We couldn't send a new code. Please try again shortly.",
};

interface PageProps {
  searchParams: Promise<{ error?: string; remaining?: string; resent?: string; next?: string }>;
}

const inputClass =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-center text-lg tracking-[0.5em] text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

export default async function VerifyPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const pending = await verifyPending((await cookies()).get(PENDING_COOKIE)?.value);
  if (!pending) redirect("/login?error=session-expired");

  const next = safeNext(sp.next) ?? "";
  const errorMsg = sp.error ? (ERRORS[sp.error] ?? "That code is incorrect.") : null;
  const remaining = Number(sp.remaining);
  const showRemaining = Number.isInteger(remaining) && remaining >= 0 && remaining <= 10;

  return (
    <div className="flex min-h-screen items-start justify-center bg-[var(--bg-secondary)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">Verify it&apos;s you</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            We emailed a 6-digit code to{" "}
            <span className="font-medium text-[var(--text-primary)]">{pending!.emailMask}</span>. It expires in 10
            minutes.
          </p>
        </div>

        {sp.resent ? (
          <div className="rounded-lg border border-[var(--t-tag-bg-emerald)] bg-[var(--t-tag-bg-emerald)] p-4 text-sm text-[var(--t-tag-text-emerald)]">
            A new code is on its way.
          </div>
        ) : null}
        {errorMsg ? (
          <div
            className="rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-4 text-sm text-[var(--t-tag-text-rose)]"
            role="alert"
          >
            {errorMsg}
            {showRemaining ? ` ${remaining} attempt(s) left.` : ""}
          </div>
        ) : null}

        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
          <form action={verifyLoginOtpAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <div>
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                className={inputClass}
                placeholder="000000"
                aria-label="6-digit code"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
              <input type="checkbox" name="trust" defaultChecked className="h-4 w-4" />
              Trust this device for 30 days
            </label>
            <div className="flex items-center justify-end border-t border-[var(--border-subtle)] pt-4">
              <button
                type="submit"
                className="w-full rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                Verify and sign in
              </button>
            </div>
          </form>
        </section>

        <form action={resendLoginOtpAction} className="text-center">
          <input type="hidden" name="next" value={next} />
          <button type="submit" className="text-xs font-medium text-[var(--accent)] hover:underline">
            Didn&apos;t get it? Send a new code
          </button>
        </form>
      </div>
    </div>
  );
}
