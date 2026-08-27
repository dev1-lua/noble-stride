// role-tabs.tsx — the "who are you?" strip on /login (F1.1, image1; Aika's
// role-first entry).
//
// The tabs are COPY-ONLY, by design. `loginWithPassword` decides where an
// account lands via its resolved viewpoint, so a client who clicks "Investor"
// still signs in and still arrives at the right home. Two reasons not to gate:
// telling a visitor "no investor account with this email" would leak which kind
// an address belongs to, and a partner contact who is also a fund contact would
// otherwise be locked out of one of their own portals.

import Link from "next/link";

export type LoginRole = "client" | "investor" | "partner" | "staff";

export const LOGIN_ROLES = ["client", "investor", "partner", "staff"] as const satisfies readonly LoginRole[];

export function parseLoginRole(raw: string | undefined): LoginRole | null {
  return (LOGIN_ROLES as readonly string[]).includes(raw ?? "") ? (raw as LoginRole) : null;
}

export const LOGIN_ROLE_COPY: Record<
  LoginRole,
  { tab: string; title: string; subtitle: string; footer: { label: string; href: string } | null }
> = {
  client: {
    tab: "Client",
    title: "Client sign in",
    subtitle: "Companies raising capital, and applications in progress",
    footer: { label: "Track your application →", href: "/apply/status" },
  },
  investor: {
    tab: "Investor",
    title: "Investor sign in",
    subtitle: "Funds and investors — the opportunity portal",
    footer: { label: "New here? Register your fund →", href: "/register?path=fund" },
  },
  partner: {
    tab: "Partner",
    title: "Partner sign in",
    subtitle: "Referral partners — the status of the deals you referred",
    footer: { label: "Have an invitation? →", href: "/register?path=partner" },
  },
  staff: {
    tab: "Noblestride staff",
    title: "Sign in",
    subtitle: "Noblestride team workspace",
    footer: null,
  },
};

export function RoleTabs({ active, next }: { active: LoginRole; next?: string }) {
  const suffix = next ? `&next=${encodeURIComponent(next)}` : "";
  return (
    <div>
      <div role="tablist" aria-label="Who are you signing in as" className="flex flex-wrap gap-1.5">
        {LOGIN_ROLES.map((role) => {
          const selected = role === active;
          return (
            <Link
              key={role}
              role="tab"
              aria-selected={selected}
              data-testid={`login-tab-${role}`}
              href={`/login?as=${role}${suffix}`}
              className={
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                (selected
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]")
              }
            >
              {LOGIN_ROLE_COPY[role].tab}
            </Link>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--text-tertiary)]">
        Tabs only change the help text — sign in with your email and password from any tab.
      </p>
    </div>
  );
}
