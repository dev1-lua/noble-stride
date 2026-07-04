"use client";

// CRM-style topbar for the investor portal — same structure as the internal
// shell topbar (title block, search, bell, avatar) minus internal-only
// affordances: no AskBar (agents are internal) and no viewpoint switcher
// (the demo lens lives in the amber banner above).
import { usePathname } from "next/navigation";
import { Search, Bell } from "lucide-react";
import { Avatar } from "@/components/ui";
import { deriveInvestorPageMeta } from "./investor-portal-nav";

export function InvestorTopbar({ investorName }: { investorName: string }) {
  const pathname = usePathname();
  const { title, subtitle } = deriveInvestorPageMeta(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-zinc-200 bg-white px-6">
      <div className="flex w-52 min-w-0 flex-shrink-0 flex-col justify-center">
        <h1 className="truncate text-lg font-bold leading-tight text-zinc-900">{title}</h1>
        {subtitle && <p className="truncate text-xs leading-tight text-zinc-500">{subtitle}</p>}
      </div>

      <div className="flex-1" />

      <div className="flex flex-shrink-0 items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
          <input
            type="text"
            placeholder="Search…"
            className="w-28 bg-transparent text-xs text-zinc-600 placeholder:text-zinc-400 focus:outline-none"
          />
        </div>

        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        <Avatar name={investorName} size="sm" color="bg-emerald-600" />
      </div>
    </header>
  );
}
