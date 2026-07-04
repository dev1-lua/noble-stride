// portal/investor/layout.tsx — CRM-style shell for the investor portal (one
// design language with the internal CRM): amber demo-lens banner on top,
// dark sidebar, sticky topbar, zinc-50 canvas. External-safe: the nav is
// portal-only and every page still renders only visibility-projected data.
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { ViewingBanner } from "@/components/portal/viewing-banner";
import { InvestorSidebar } from "@/components/portal/investor-sidebar";
import { InvestorTopbar } from "@/components/portal/investor-topbar";

export default async function InvestorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fund name for the topbar avatar; pages themselves gate + redirect
  // non-investor viewpoints, so a fallback label is fine here.
  const vp = await getViewpoint();
  const investor =
    vp.role === "investor" && vp.recordId
      ? await prisma.investor.findUnique({
          where: { id: vp.recordId },
          select: { name: true },
        })
      : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-50">
      <div className="flex-shrink-0">
        <ViewingBanner />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <InvestorSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <InvestorTopbar investorName={investor?.name ?? "Investor"} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
            <p className="pt-8 text-xs text-zinc-400">
              Confidential — shared under the terms of your NDA with NobleStride Capital.
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}
