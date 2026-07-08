// login/page.tsx — dummy sign-in (landing spec §6). DEMO ONLY: the email is
// looked up against contacts; the password is cosmetic. No credentials, no
// sessions — the viewpoint cookie is the "session" (memory/remaining-tasks.md).

import Link from "next/link";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ error?: string; email?: string; as?: string }>;
}

const inputClass =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";

export default async function LoginPage({ searchParams }: PageProps) {
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

        <div className="rounded-lg border border-[var(--t-tag-bg-amber)] bg-[var(--t-tag-bg-amber)] p-4 text-sm text-[var(--t-tag-text-amber)]">
          Demo mode — any password works. Your email decides where you land: investor and partner
          contacts go to their portal, NobleStride team emails go to the CRM.
        </div>

        {sp.error && (
          <div className="rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-4 text-sm text-[var(--t-tag-text-rose)]">
            {sp.error}{" "}
            {sp.error.startsWith("No account") && (
              <Link href="/register" className="font-semibold underline">
                Register your fund →
              </Link>
            )}
          </div>
        )}

        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
          <form action={loginAction} className="space-y-4">
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
                placeholder="Any password (demo)"
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
          </form>
        </section>
      </div>
    </div>
  );
}
