import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { getOrgLens } from "@/server/rbac/context";
import { label } from "@/lib/vocab";

// CRM pages read live data from Postgres per request — never prerender them at
// build time (that needs the DB at build and would freeze data into static HTML).
// Set on the layout so it cascades to every (crm)/* route.
export const dynamic = "force-dynamic";

export default async function CRMLayout({ children }: { children: React.ReactNode }) {
  // External viewpoints never see the internal shell (spec §6) — they land on
  // their portal. The visibility engine gates everything they read there.
  const vp = await getViewpoint();
  if (vp.role === "investor") redirect("/portal/investor");
  if (vp.role === "partner") redirect("/portal/partner");

  const [investors, partners, users, pendingReview] = await Promise.all([
    prisma.investor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.partner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.investor.count({ where: { onboardingStatus: "PendingReview" } }),
  ]);

  // §7.2 in-org lens (demo): banner names the active role + user.
  const lens = await getOrgLens();
  const lensUser = lens.userId ? users.find((u) => u.id === lens.userId) : undefined;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Fixed-width sidebar, full height */}
      <Sidebar pendingReview={pendingReview} />

      {/* Main content region */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Sticky topbar */}
        <Topbar
          investors={investors}
          partners={partners}
          users={users}
          activeOrgRole={vp.orgRole ?? "Admin"}
          activeUserId={vp.userId}
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
