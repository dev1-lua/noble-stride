import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

// CRM pages read live data from Postgres per request — never prerender them at
// build time (that needs the DB at build and would freeze data into static HTML).
// Set on the layout so it cascades to every (crm)/* route.
export const dynamic = "force-dynamic";

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Fixed-width sidebar, full height */}
      <Sidebar />

      {/* Main content region */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Sticky topbar */}
        <Topbar />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-zinc-50 p-6">{children}</main>
      </div>
    </div>
  );
}
