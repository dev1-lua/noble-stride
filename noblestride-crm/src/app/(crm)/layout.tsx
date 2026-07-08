import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { getOrgLens } from "@/server/rbac/context";
import { getCurrentAuth } from "@/server/auth/current";
import { label } from "@/lib/vocab";
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

  const [investors, partners, users, pendingReview, auth] = await Promise.all([
    prisma.investor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.partner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.investor.count({ where: { onboardingStatus: "PendingReview" } }),
    getCurrentAuth(),
  ]);

  // §7.2 in-org lens (demo): banner names the active role + user.
  const lens = await getOrgLens();
  const lensUser = lens.userId ? users.find((u) => u.id === lens.userId) : undefined;

  // Task 14 bell: server-rendered per request, no polling. Demo-lens mode:
  // when the lens has no resolved userId (Admin fallback), the bell shows an
  // empty state rather than fetching for all users.
  const [unreadNotifications, unreadCount] = lens.userId
    ? await Promise.all([unreadFor(lens.userId, 15), unreadCountFor(lens.userId)])
    : [[], 0];
  const notifications = unreadNotifications.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    href: n.href,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Fixed-width sidebar, full height */}
      <Sidebar pendingReview={pendingReview} isAdmin={auth?.user?.role === "Admin"} />

      {/* Main content region */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Sticky topbar */}
        <Topbar
          investors={investors}
          partners={partners}
          users={users}
          activeOrgRole={vp.orgRole ?? "Admin"}
          activeUserId={vp.userId}
          notifications={notifications}
          notificationCount={unreadCount}
          switcherEnabled={auth?.user?.role === "Admin"}
        />

        {/* Org-role lens banner (demo lens, spec §7.2) */}
        {lens.orgRole !== "Admin" && (
          <div className="border-b border-[var(--t-tag-bg-amber)] bg-[var(--t-tag-bg-amber)] px-6 py-1.5 text-xs text-[var(--t-tag-text-amber)]">
            Viewing as <span className="font-semibold">{label("OrgRole", lens.orgRole)}</span>
            {lensUser ? <> — {lensUser.name}</> : null} · demo lens, controls hidden per the{" "}
            <a href="/access-matrix" className="underline">
              access matrix
            </a>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[var(--bg-secondary)] p-6">{children}</main>
      </div>
    </div>
  );
}
