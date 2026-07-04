// portal/partner/layout.tsx — the external partner shell (design spec
// §5.3–§5.4, §6): amber demo-lens banner, emerald brand header, centered
// column with the partner sub-navigation. Deliberately separate from the
// internal CRM shell — partners only ever see what the visibility engine
// projects.
import { ViewingBanner } from "@/components/portal/viewing-banner";
import { PartnerTabs } from "@/components/portal/partner-tabs";

export default function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <ViewingBanner />
      <header className="border-b border-zinc-200 bg-emerald-950 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <div className="text-lg font-bold tracking-tight text-white">NobleStride Capital</div>
            <div className="text-xs text-emerald-200/80">
              Create. Value. Investing. Sub-Saharan Africa
            </div>
          </div>
          <div className="text-xs uppercase tracking-widest text-emerald-200/60">
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
      <footer className="mx-auto max-w-5xl px-6 pb-8 text-xs text-zinc-400">
        Confidential — shared under the terms of your NDA with NobleStride Capital.
      </footer>
    </div>
  );
}
