import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";

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

  const [investors, partners] = await Promise.all([
    prisma.investor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.partner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Fixed-width sidebar, full height */}
      <Sidebar />

      {/* Main content region */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Sticky topbar */}
        <Topbar investors={investors} partners={partners} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-zinc-50 p-6">{children}</main>
      </div>
    </div>
  );
}
