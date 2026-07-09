// portal/partner/layout.tsx — the external partner shell (design spec
// §5.3–§5.4, §6): amber demo-lens banner, emerald brand header, centered
// column with the partner sub-navigation. Deliberately separate from the
// internal CRM shell — partners only ever see what the visibility engine
// projects.
import { ViewingBanner } from "@/components/portal/viewing-banner";
import { PartnerTabs } from "@/components/portal/partner-tabs";

export default function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <ViewingBanner />
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <div className="text-lg font-bold tracking-tight text-emerald-950">NobleStride Capital</div>
            <div className="text-xs text-[var(--text-tertiary)]">
              Create. Value. Investing. Sub-Saharan Africa
            </div>
          </div>
          <div className="text-xs uppercase tracking-widest text-[var(--text-tertiary)]">
            Partner Portal
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
        Confidential — shared under the terms of your NDA with NobleStride Capital.
      </footer>
    </div>
  );
}
