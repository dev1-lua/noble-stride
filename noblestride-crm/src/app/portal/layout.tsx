// portal/layout.tsx — external portal shell (design spec §5.3–§5.4, §6).
// Deliberately separate from the internal CRM shell: no sidebar, no internal
// nav — external roles only ever see what the visibility engine projects.
import Link from "next/link";
import { getViewpoint } from "@/server/viewpoint";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const vp = await getViewpoint();

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-sm text-amber-800 flex items-center justify-between">
        <span>
          Viewing as <span className="font-semibold capitalize">{vp.role}</span> — external portal
          view, gated by engagement stage
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
