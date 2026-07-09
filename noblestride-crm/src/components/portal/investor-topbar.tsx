"use client";

// CRM-style topbar for the investor portal — same structure as the internal
// shell topbar (title block, search, bell) minus internal-only affordances:
// no AskBar (agents are internal). The avatar + sign-out live in the sidebar
// footer (SidebarProfile) instead.
import { usePathname } from "next/navigation";
import { Search, Bell } from "lucide-react";
import { deriveInvestorPageMeta } from "./investor-portal-nav";

export function InvestorTopbar() {
  const pathname = usePathname();
  const { title, subtitle } = deriveInvestorPageMeta(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-4 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] px-6">
      <div className="flex w-52 min-w-0 flex-shrink-0 flex-col justify-center">
        <h1 className="truncate text-sm font-semibold leading-tight text-[var(--text-primary)]">{title}</h1>
        {subtitle && <p className="truncate text-[11px] leading-tight text-[var(--text-tertiary)]">{subtitle}</p>}
      </div>

      <div className="flex-1" />

      <div className="flex flex-shrink-0 items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Search…"
            className="w-28 bg-transparent text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
          />
        </div>

        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-tertiary)]"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
