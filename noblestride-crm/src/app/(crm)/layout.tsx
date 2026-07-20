import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { getCurrentAuth } from "@/server/auth/current";
import { unreadFor, unreadCountFor } from "@/server/services/notifications";

// CRM pages read live data from Postgres per request — never prerender them at
// build time (that needs the DB at build and would freeze data into static HTML).
// Set on the layout so it cascades to every (crm)/* route.
export const dynamic = "force-dynamic";

export default async function CRMLayout({ children }: { children: React.ReactNode }) {
  // External viewpoints never see the internal shell (spec §6) — they land on
  // their portal. The visibility engine gates everything they read there.
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role === "investor") redirect("/portal/investor");
  if (vp.role === "partner") redirect("/portal/partner");

  // Two distinct review queues: pendingReview = investors awaiting onboarding
  // approval (Investors row badge); pendingChanges = agent-captured profile
  // updates awaiting confirmation (Investor Updates agent card badge).
  const [pendingReview, pendingChanges, auth] = await Promise.all([
    prisma.investor.count({ where: { onboardingStatus: "PendingReview" } }),
    prisma.investorProposedChange.count({ where: { status: "Pending" } }),
    getCurrentAuth(),
  ]);

  // Task 14 bell: server-rendered per request, no polling, keyed on the real
  // signed-in user (no lens to fall back on now).
  const userId = auth?.user?.id;
  const [unreadNotifications, unreadCount] = userId
    ? await Promise.all([unreadFor(userId, 15), unreadCountFor(userId)])
    : [[], 0];
  const notifications = unreadNotifications.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    href: n.href,
    createdAt: n.createdAt.toISOString(),
  }));

  // Task 7: sidebar profile block — name falls back to account displayName,
  // then to email; email is the account's login email.
  const userName = auth?.user?.name ?? auth?.account.displayName ?? auth?.account.email ?? "";
  const userEmail = auth?.account.email ?? "";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Fixed-width sidebar, full height */}
      <Sidebar
        pendingReview={pendingReview}
        pendingChanges={pendingChanges}
        isAdmin={auth?.user?.role === "Admin"}
        userName={userName}
        userEmail={userEmail}
      />

      {/* Main content region */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Sticky topbar */}
        <Topbar notifications={notifications} notificationCount={unreadCount} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[var(--bg-secondary)] p-6">{children}</main>
      </div>
    </div>
  );
}
