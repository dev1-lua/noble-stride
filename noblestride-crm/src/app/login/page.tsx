// login/page.tsx — real credential sign-in (real-auth spec §10). Errors
// round-trip via query params; the session cookie is set by the server
// action, not here.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewpoint } from "@/server/viewpoint";
import { viewpointHome } from "@/lib/viewpoint";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ error?: string; email?: string; as?: string; next?: string }>;
}

const inputClass =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";

// Machine slugs used by the 2FA bounce paths (login/verify/actions.ts,
// login/verify/page.tsx) redirect here as `?error=<slug>` — map them to
// human copy. Any other value (loginAction's `back()` already passes full
// sentences) is rendered verbatim via the `?? error` fallback below.
const ERROR_COPY: Record<string, string> = {
  "session-expired": "Your sign-in session expired. Please sign in again.",
  "code-expired": "Your code expired. Please sign in again to get a new one.",
  "too-many-codes": "Too many incorrect codes. Please sign in again to get a new code.",
  locked: "Too many attempts. Please try again in a little while.",
  suspended: "This account is suspended. Contact NobleStride if you believe this is an error.",
};

export default async function LoginPage({ searchParams }: PageProps) {
  // Gate on the resolved VIEWPOINT (same predicate the CRM/portal layouts
  // use), not merely on auth existing. An ACTIVE account can still resolve
  // to a null viewpoint (e.g. an investor whose Investor row was deleted, or
  // a deactivated internal user) — if we redirected on auth alone, that
  // account would bounce login -> portal/dashboard -> login forever, with no
  // way to reach the sign-in form or sign out. A null viewpoint must render
  // the form instead.
  const vp = await getViewpoint();
  if (vp) redirect(viewpointHome(vp));

  const sp = await searchParams;
  const isInvestor = sp.as === "investor";

  return (
    <div className="flex min-h-screen items-start justify-center bg-[var(--bg-secondary)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold tracking-tight text-emerald-950">
            NobleStride Capital
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
            {isInvestor ? "Investor sign in" : "Sign in"}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            {isInvestor ? "Investor & partner portal access" : "NobleStride team workspace"}
          </p>
        </div>

        {sp.error && (
          <div className="rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-4 text-sm text-[var(--t-tag-text-rose)]">
            {ERROR_COPY[sp.error] ?? sp.error}
          </div>
        )}

        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
          <form action={loginAction} className="space-y-4">
            {sp.next ? <input type="hidden" name="next" value={sp.next} /> : null}
            <div>
              <label htmlFor="email" className={labelClass}>
                Email <span className="text-rose-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={sp.email ?? ""}
                placeholder="name@fund.com"
                className={"mt-1 " + inputClass}
              />
            </div>
            <div>
              <label htmlFor="password" className={labelClass}>
                Password <span className="text-rose-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="Your password"
                className={"mt-1 " + inputClass}
              />
            </div>
            <div
              className={
                "flex items-center gap-4 border-t border-[var(--border-subtle)] pt-4 " +
                (isInvestor ? "justify-between" : "justify-end")
              }
            >
              {isInvestor && (
                <Link
                  href="/register"
                  className="text-xs font-medium text-[var(--accent)] hover:underline"
                >
                  New here? Register your fund →
                </Link>
              )}
              <button
                type="submit"
                className="rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                Sign in
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4 text-xs">
              <Link href="/forgot-password" className="font-medium text-[var(--accent)] hover:underline">
                Forgot password?
              </Link>
              <Link href="/register" className="font-medium text-[var(--accent)] hover:underline">
                Create an account →
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
