// portal/investor/layout.tsx — CRM-style shell for the investor portal (one
// design language with the internal CRM): amber demo-lens banner on top,
// light sidebar, slim topbar, neutral canvas. External-safe: the nav is
// portal-only and every page still renders only visibility-projected data.
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { isBlockedClassification } from "@/server/visibility/tiers";
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
          select: { name: true, onboardingStatus: true, engagementClassification: true, ndaStatus: true },
        })
      : null;

  // Blocked classification wins over onboarding status (build spec §11.2:
  // excluded/greylisted funds never see opportunities): a greylisted
  // registration is also Rejected, but must NOT see the "not approved" copy.
  // Deliberately neutral — never reveals the classification.
  if (investor && isBlockedClassification(investor.engagementClassification)) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg-secondary)]">
        <div className="flex-shrink-0">
          <ViewingBanner />
        </div>
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-8 text-center">
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Portal access restricted</h1>
            <p className="mt-3 text-sm text-[var(--text-tertiary)]">
              Your portal access is currently restricted. Contact NobleStride Capital if you believe
              this is an error.
            </p>
            <p className="mt-6 text-xs text-[var(--text-tertiary)]">
              No opportunity information is available for this account.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (investor && investor.onboardingStatus !== "Approved") {
    const pending = investor.onboardingStatus === "PendingReview";
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg-secondary)]">
        <div className="flex-shrink-0">
          <ViewingBanner />
        </div>
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-8 text-center">
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              {pending ? "Registration under review" : "Registration not approved"}
            </h1>
            <p className="mt-3 text-sm text-[var(--text-tertiary)]">
              {pending
                ? `Thank you for registering ${investor.name}. The NobleStride team reviews every investor before granting deal visibility. You will be contacted at your corporate email once approved.`
                : "This registration was not approved. Contact NobleStride Capital if you believe this is an error."}
            </p>
            <p className="mt-6 text-xs text-[var(--text-tertiary)]">
              No opportunity information is visible before approval.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg-secondary)]">
      <div className="flex-shrink-0">
        <ViewingBanner />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <InvestorSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <InvestorTopbar investorName={investor?.name ?? "Investor"} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
            <p className="pt-8 text-xs text-[var(--text-tertiary)]">
              {investor && investor.ndaStatus !== "None"
                ? "Confidential — shared under the terms of your NDA with NobleStride Capital."
                : "Confidential — for your review only. Please do not distribute."}
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}
