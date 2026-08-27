// portal/partner/layout.tsx — the external partner shell (design spec
// §5.3–§5.4, §6): emerald brand header, centered column with the partner
// sub-navigation. Deliberately separate from the internal CRM shell —
// partners only ever see what the visibility engine projects.
//
// F5.6 (Aug-2026 feedback: "partners should log in to the portal to see deal
// status"): this shell is no longer dormant. requirePartnerMember is the server
// gate — every page under /portal/partner is behind a real PARTNER session, and
// a non-partner session is redirected to /login.
import { LogOut } from "lucide-react";
import { PartnerTabs } from "@/components/portal/partner-tabs";
import { requirePartnerMember } from "@/server/auth/portal-authz";
import { logoutAction } from "@/app/logout/actions";

export default async function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  const member = await requirePartnerMember();
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <div className="text-lg font-bold tracking-tight text-emerald-950">Noblestride Capital</div>
            <div className="text-xs text-[var(--text-tertiary)]">
              Create. Value. Investing. Sub-Saharan Africa
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest text-[var(--text-tertiary)]">
                Partner Portal
              </div>
              <div className="text-sm font-medium text-[var(--text-primary)]" data-testid="partner-member">
                {member.label}
              </div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-tertiary)]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="space-y-6">
          <PartnerTabs />
          {children}
        </div>
      </main>
      <footer className="mx-auto max-w-5xl px-6 pb-8 text-xs text-[var(--text-tertiary)]">
        Confidential — shared under the terms of your NDA with Noblestride Capital.
      </footer>
    </div>
  );
}
