// login/page.tsx — real credential sign-in (real-auth spec §10). Cross-page
// notices/errors arrive via `?notice`/`?error` slugs, mapped through the
// fixed allow-list in messages.ts — never rendered verbatim. Credentials
// live only in client state (LoginForm's useActionState), never in the URL.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewpoint } from "@/server/viewpoint";
import { viewpointHome } from "@/lib/viewpoint";
import { LoginForm } from "./login-form";
import { loginNotice } from "./messages";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ error?: string; notice?: string; as?: string; next?: string }>;
}

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
  const notice = loginNotice(sp.notice ?? sp.error); // fixed allow-list; never reflects arbitrary strings

  return (
    <div className="flex min-h-screen items-start justify-center bg-[var(--bg-secondary)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold tracking-tight text-emerald-950">
            Noblestride Capital
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
            {isInvestor ? "Investor sign in" : "Sign in"}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            {isInvestor ? "Investor & partner portal access" : "Noblestride team workspace"}
          </p>
        </div>
        {notice && (
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
            {notice}
          </div>
        )}
        <LoginForm isInvestor={isInvestor} next={sp.next} />
      </div>
    </div>
  );
}
