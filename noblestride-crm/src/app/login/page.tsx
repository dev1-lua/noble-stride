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
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

const labelClass = "block text-xs font-medium uppercase tracking-wide text-zinc-500";

export default async function LoginPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const isInvestor = sp.as === "investor";

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold tracking-tight text-emerald-950">
            NobleStride Capital
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-zinc-900">
            {isInvestor ? "Investor sign in" : "Sign in"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isInvestor ? "Investor & partner portal access" : "NobleStride team workspace"}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Demo mode — any password works. Your email decides where you land: investor and partner
          contacts go to their portal, NobleStride team emails go to the CRM.
        </div>

        {sp.error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {sp.error}{" "}
            {sp.error.startsWith("No account") && (
              <Link href="/register" className="font-semibold underline">
                Register your fund →
              </Link>
            )}
          </div>
        )}

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
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
                "flex items-center gap-4 border-t border-zinc-100 pt-4 " +
                (isInvestor ? "justify-between" : "justify-end")
              }
            >
              {isInvestor && (
                <Link
                  href="/register"
                  className="text-xs font-medium text-emerald-800 hover:underline"
                >
                  New here? Register your fund →
                </Link>
              )}
              <button
                type="submit"
                className="rounded-full bg-emerald-950 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
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
