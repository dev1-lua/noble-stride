// login/page.tsx — real credential sign-in (real-auth spec §10). Cross-page
// notices/errors arrive via `?notice`/`?error` slugs, mapped through the
// fixed allow-list in messages.ts — never rendered verbatim. Credentials
// live only in client state (LoginForm's useActionState), never in the URL.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewpoint } from "@/server/viewpoint";
import { viewpointHome } from "@/lib/viewpoint";
import { LoginForm } from "./login-form";
import { RoleTabs, LOGIN_ROLE_COPY, parseLoginRole } from "./role-tabs";
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
  // F1.1: `?as=` only chooses which copy to show. An unknown value falls back to
  // staff rather than being reflected anywhere near the page.
  const role = parseLoginRole(sp.as) ?? "staff";
  const copy = LOGIN_ROLE_COPY[role];
  const notice = loginNotice(sp.notice ?? sp.error); // fixed allow-list; never reflects arbitrary strings

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] lg:grid lg:grid-cols-2">
      {/* Brand panel — left on desktop, a slim band above the card on mobile. */}
      <aside className="flex flex-col justify-between bg-emerald-950 px-8 py-10 text-emerald-50 lg:px-12 lg:py-16">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Noblestride Capital
        </Link>
        <div className="mt-8 hidden lg:block">
          <p className="text-3xl font-bold leading-tight">Create. Value. Investing.</p>
          <p className="mt-2 text-sm text-emerald-200">Sub-Saharan Africa</p>
          <p className="mt-8 max-w-sm text-sm leading-relaxed text-emerald-100">
            One place for the people around a deal: the companies raising capital, the investors
            backing them, the partners who introduced them, and the Noblestride team running the
            process.
          </p>
        </div>
        <p className="mt-8 hidden text-xs text-emerald-300 lg:block">
          Confidential. Access is granted per deal, and only after an NDA.
        </p>
      </aside>

      <main className="flex items-start justify-center px-4 py-12 lg:items-center lg:px-8">
        <div className="w-full max-w-md space-y-6">
          <div>
            <RoleTabs active={role} next={sp.next} />
            <h1 className="mt-5 text-2xl font-bold text-[var(--text-primary)]">{copy.title}</h1>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">{copy.subtitle}</p>
          </div>
          {notice && (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
              {notice}
            </div>
          )}
          <LoginForm role={role} next={sp.next} />
        </div>
      </main>
    </div>
  );
}
