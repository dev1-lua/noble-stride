// portal/investor/layout.tsx — CRM-style shell for the investor portal (one
// design language with the internal CRM): light sidebar, slim topbar, neutral
// canvas. External-safe: the nav is portal-only and every page still renders
// only visibility-projected data.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { getCurrentAuth } from "@/server/auth/current";
import { isBlockedClassification } from "@/server/visibility/tiers";
import { InvestorSidebar } from "@/components/portal/investor-sidebar";
import { InvestorTopbar } from "@/components/portal/investor-topbar";
import { unreadForInvestor, unreadCountForInvestor } from "@/server/services/notifications";
import { Card, CardBody } from "@/components/ui/card";

export default async function InvestorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fund name for the topbar; pages themselves gate + redirect non-investor
  // viewpoints, so a fallback label is fine here.
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  const investor =
    vp.role === "investor" && vp.recordId
      ? await prisma.investor.findUnique({
          where: { id: vp.recordId },
          select: { name: true, onboardingStatus: true, engagementClassification: true, ndaStatus: true },
        })
      : null;

  // Task 7 sidebar profile: person's name if we have one, else the fund
  // name, else the account email; the account email is always the second
  // (fallback/secondary) line. getCurrentAuth is React-cached, so this is
  // not an extra DB round trip beyond what getViewpoint already did.
  const auth = await getCurrentAuth();
  const personName = auth?.person
    ? [auth.person.firstName, auth.person.lastName].filter(Boolean).join(" ")
    : "";
  const sidebarName = personName || investor?.name || auth?.account.email || "";
  const sidebarEmail = auth?.account.email ?? "";

  // Blocked classification wins over onboarding status (build spec §11.2:
  // excluded/greylisted funds never see opportunities): a greylisted
  // registration is also Rejected, but must NOT see the "not approved" copy.
  // Deliberately neutral — never reveals the classification.
  if (investor && isBlockedClassification(investor.engagementClassification)) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg-secondary)]">
        <main className="flex flex-1 items-center justify-center p-6">
          <Card className="max-w-md">
            <CardBody className="p-8 text-center">
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">Portal access restricted</h1>
              <p className="mt-3 text-sm text-[var(--text-tertiary)]">
                Your portal access is currently restricted. Contact Noblestride Capital if you believe
                this is an error.
              </p>
              <p className="mt-6 text-xs text-[var(--text-tertiary)]">
                No opportunity information is available for this account.
              </p>
            </CardBody>
          </Card>
        </main>
      </div>
    );
  }

  if (investor && investor.onboardingStatus !== "Approved") {
    const pending = investor.onboardingStatus === "PendingReview";
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg-secondary)]">
        <main className="flex flex-1 items-center justify-center p-6">
          <Card className="max-w-md">
            <CardBody className="p-8 text-center">
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                {pending ? "Registration under review" : "Registration not approved"}
              </h1>
              <p className="mt-3 text-sm text-[var(--text-tertiary)]">
                {pending
                  ? `Thank you for registering ${investor.name}. The Noblestride team reviews every investor before granting deal visibility. You will be contacted at your corporate email once approved.`
                  : "This registration was not approved. Contact Noblestride Capital if you believe this is an error."}
              </p>
              <p className="mt-6 text-xs text-[var(--text-tertiary)]">
                No opportunity information is visible before approval.
              </p>
            </CardBody>
          </Card>
        </main>
      </div>
    );
  }

  // Portal notification feed (client feedback 2026-07): server-rendered per
  // request, same no-polling contract as the internal bell.
  const investorId = vp.role === "investor" ? vp.recordId : null;
  const [unread, unreadCount] = investorId
    ? await Promise.all([unreadForInvestor(investorId, 15), unreadCountForInvestor(investorId)])
    : [[], 0];
  const notifications = unread.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    href: n.href,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg-secondary)]">
      <div className="flex flex-1 overflow-hidden">
        <InvestorSidebar name={sidebarName} email={sidebarEmail} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <InvestorTopbar notifications={notifications} notificationCount={unreadCount} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
            <p className="pt-8 text-xs text-[var(--text-tertiary)]">
              {investor && investor.ndaStatus !== "None"
                ? "Confidential — shared under the terms of your NDA with Noblestride Capital."
                : "Confidential — for your review only. Please do not distribute."}
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}
