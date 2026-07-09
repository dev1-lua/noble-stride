"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Avatar } from "@/components/ui";
import { AskBar } from "./ask-bar";
import { ViewpointSwitcher, type ViewpointOption } from "./viewpoint-switcher";
import { NotificationBell, type NotificationItem } from "./notification-bell";
import { HelpPanel } from "./help-panel";
import { logoutAction } from "@/app/logout/actions";

// ─── Route → title/subtitle map ──────────────────────────────────────────────

interface PageMeta {
  title: string;
  subtitle: string;
}

const ROUTE_META: Record<string, PageMeta> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Where the pipeline stands today — deals, investors, tasks, and money in motion",
  },
  "/deals": {
    title: "Deals",
    subtitle: "Every assignment we've been hired for (mandates) and every live raise (transactions), in one queue",
  },
  "/mandates": {
    title: "Mandates",
    subtitle: "Client mandates — the assignments behind every raise",
  },
  "/transactions": {
    title: "Transactions",
    subtitle: "Live fundraising transactions",
  },
  "/investors": {
    title: "Investors",
    subtitle: "The investor database — who invests in what, and where each relationship stands",
  },
  "/engagement": {
    title: "Engagement",
    subtitle: "Which investors have seen each deal, and how far each conversation has gone",
  },
  "/partners": {
    title: "Partners",
    subtitle: "Referral partners and advisors — who introduced which deals, and what we owe them",
  },
  "/clients": {
    title: "Clients",
    subtitle: "The companies we raise capital for — profile, financials, and their documents",
  },
  "/documents": {
    title: "Documents",
    subtitle: "The register of teasers, IMs, NDAs and models — and who is allowed to see each",
  },
  "/access-matrix": {
    title: "Access Matrix",
    subtitle: "Who sees what inside NobleStride",
  },
  "/tasks": {
    title: "Tasks",
    subtitle: "Action items and follow-ups — who owes what, by when",
  },
  "/service-providers": {
    title: "Service Providers",
    subtitle: "Lawyers, auditors and DD firms engaged on transactions",
  },
};

function derivePageMeta(pathname: string): PageMeta {
  // Exact match first
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];

  // Prefix match (e.g. /mandates/123)
  const match = Object.keys(ROUTE_META).find((key) => pathname.startsWith(key + "/"));
  if (match) return ROUTE_META[match];

  // Fallback: derive title from first segment
  const segment = pathname.split("/").filter(Boolean)[0] ?? "";
  const title = segment.charAt(0).toUpperCase() + segment.slice(1);
  return { title: title || "NobleStride", subtitle: "" };
}

// ─── Topbar ──────────────────────────────────────────────────────────────────

export function Topbar({
  investors = [],
  partners = [],
  users = [],
  activeOrgRole,
  activeUserId,
  notifications = [],
  notificationCount = 0,
  switcherEnabled = false,
}: {
  investors?: ViewpointOption[];
  partners?: ViewpointOption[];
  users?: ViewpointOption[];
  activeOrgRole?: string;
  activeUserId?: string;
  notifications?: NotificationItem[];
  notificationCount?: number;
  switcherEnabled?: boolean;
}) {
  const pathname = usePathname();
  const { title, subtitle } = derivePageMeta(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-4 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] px-6">
      {/* Page title block */}
      <div className="flex flex-col justify-center min-w-0 flex-shrink-0 w-auto">
        <h1 className="text-sm font-semibold leading-tight text-[var(--text-primary)] truncate">{title}</h1>
        {subtitle && (
          <p className="text-[11px] text-[var(--text-tertiary)] leading-tight truncate hidden lg:block">{subtitle}</p>
        )}
      </div>

      {/* AskBar — center */}
      <div className="flex flex-1 justify-center">
        <AskBar />
      </div>

      {/* Right controls */}
      <div className="flex flex-shrink-0 items-center gap-3">
        {/* Help panel (Task 18) — journey guide, glossary, access matrix link. Supports ?help=journey deep link. */}
        <HelpPanel />

        {/* View-as switcher (admin-only lens, spec §6 + §7.2 org roles) */}
        <ViewpointSwitcher
          investors={investors}
          partners={partners}
          users={users}
          activeOrgRole={activeOrgRole}
          activeUserId={activeUserId}
          enabled={switcherEnabled}
        />

        {/* Sign out — real logout: revokes the DB session, clears cookies */}
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Sign out
          </button>
        </form>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-[var(--text-tertiary)] flex-shrink-0" />
          <input
            type="text"
            placeholder="Search…"
            className="w-28 bg-transparent text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
          />
        </div>

        {/* Notification bell (Task 14) — server-fetched initial data, no polling */}
        <NotificationBell initialItems={notifications} initialCount={notificationCount} />

        {/* Avatar */}
        <Avatar name="NS" size="sm" color="bg-emerald-600" />
      </div>
    </header>
  );
}
