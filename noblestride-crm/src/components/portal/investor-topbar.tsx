"use client";

// CRM-style topbar for the investor portal — same structure as the internal
// shell topbar (title block, search, bell) minus internal-only affordances:
// no AskBar (agents are internal). The avatar + sign-out live in the sidebar
// footer (SidebarProfile) instead.
import { usePathname } from "next/navigation";
import { deriveInvestorPageMeta } from "./investor-portal-nav";
import { CommandPalette } from "@/components/search/command-palette";
import { InvestorNotificationBell, type PortalNotificationItem } from "./investor-notification-bell";

export function InvestorTopbar({
  notifications = [],
  notificationCount = 0,
}: {
  notifications?: PortalNotificationItem[];
  notificationCount?: number;
}) {
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
        {/* Global search (Task 3/D) — same query, server scopes to this investor */}
        <CommandPalette />

        <InvestorNotificationBell initialItems={notifications} initialCount={notificationCount} />
      </div>
    </header>
  );
}
