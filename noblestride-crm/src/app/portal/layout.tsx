// portal/layout.tsx — external portal shell (design spec §5.3–§5.4, §6).
// Deliberately separate from the internal CRM shell: no sidebar, no internal
// nav — external roles only ever see what the visibility engine projects.
// The amber banner is the demo lens: it names who you're viewing as (with
// classification, so an empty portal for a Greylisted fund is self-explaining)
// and lets you hop to another investor/partner inline.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { label } from "@/lib/vocab";
import { PortalSwitcher } from "@/components/portal/portal-switcher";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const vp = await getViewpoint();

  const [investors, partners] = await Promise.all([
    prisma.investor.findMany({
      select: { id: true, name: true, engagementClassification: true },
      orderBy: { name: "asc" },
    }),
    prisma.partner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const investorOptions = investors.map((i) => ({
    id: i.id,
    name: i.name,
    hint: label("InvestorEngagementClassification", i.engagementClassification),
  }));
  const partnerOptions = partners.map((p) => ({ id: p.id, name: p.name }));

  const current =
    vp.role === "investor"
      ? investorOptions.find((i) => i.id === vp.recordId)
      : vp.role === "partner"
        ? partnerOptions.find((p) => p.id === vp.recordId)
        : undefined;
  const hint = current && "hint" in current ? (current as { hint?: string }).hint : undefined;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-800">
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>
            Viewing as{" "}
            {vp.role === "investor" || vp.role === "partner" ? (
              <PortalSwitcher
                role={vp.role}
                recordId={vp.recordId ?? ""}
                investors={investorOptions}
                partners={partnerOptions}
              />
            ) : (
              <span className="font-semibold capitalize">{vp.role}</span>
            )}
          </span>
          {hint && hint !== "Active" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold">
              {hint} — this fund is blocked from all deal visibility
            </span>
          )}
        </span>
        <Link
          href="/api/viewpoint?role=admin"
          className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
        >
          Return to Admin
        </Link>
      </div>
      <header className="border-b border-zinc-200 bg-emerald-950 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <div className="text-lg font-bold tracking-tight text-white">NobleStride Capital</div>
            <div className="text-xs text-emerald-200/80">Create. Value. Investing. Sub-Saharan Africa</div>
          </div>
          <div className="text-xs uppercase tracking-widest text-emerald-200/60">
            {vp.role === "partner" ? "Partner Portal" : "Investor Portal"}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      <footer className="mx-auto max-w-5xl px-6 pb-8 text-xs text-zinc-400">
        Confidential — shared under the terms of your NDA with NobleStride Capital.
      </footer>
    </div>
  );
}
