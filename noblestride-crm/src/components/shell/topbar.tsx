"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Search, Bell } from "lucide-react";
import { Avatar } from "@/components/ui";
import { AskBar } from "./ask-bar";
import { ViewpointSwitcher, type ViewpointOption } from "./viewpoint-switcher";
import { cn } from "@/lib/cn";

// ─── Route → title/subtitle map ──────────────────────────────────────────────

interface PageMeta {
  title: string;
  subtitle: string;
}

const ROUTE_META: Record<string, PageMeta> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Overview of your deal pipeline and investor activity",
  },
  "/deals": {
    title: "Deals",
    subtitle: "Mandates and transactions in one unified queue",
  },
  "/mandates": {
    title: "Mandates",
    subtitle: "Advisory mandates across all stages",
  },
  "/transactions": {
    title: "Transactions",
    subtitle: "Live fundraising transactions",
  },
  "/investors": {
    title: "Investors",
    subtitle: "Investor network and engagement",
  },
  "/engagement": {
    title: "Engagement",
    subtitle: "Interaction tracker and timeline",
  },
  "/partners": {
    title: "Partners",
    subtitle: "Referral partners and advisors",
  },
  "/clients": {
    title: "Clients",
    subtitle: "Portfolio company profile",
  },
  "/documents": {
    title: "Documents",
    subtitle: "Deal documents, access levels and review status",
  },
  "/access-matrix": {
    title: "Access Matrix",
    subtitle: "Who sees what inside NobleStride",
  },
  "/tasks": {
    title: "Tasks",
    subtitle: "Team action points and deadlines",
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
}: {
  investors?: ViewpointOption[];
  partners?: ViewpointOption[];
  users?: ViewpointOption[];
  activeOrgRole?: string;
  activeUserId?: string;
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
        {/* View-as switcher (demo lens, spec §6 + §7.2 org roles) */}
        <ViewpointSwitcher
          investors={investors}
          partners={partners}
          users={users}
          activeOrgRole={activeOrgRole}
          activeUserId={activeUserId}
        />

        {/* Sign out — clears demo viewpoint cookie, returns to public landing */}
        <Link
          href="/api/viewpoint?role=signout"
          className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          Sign out
        </Link>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-[var(--text-tertiary)] flex-shrink-0" />
          <input
            type="text"
            placeholder="Search…"
            className="w-28 bg-transparent text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
          />
        </div>

        {/* Notification bell */}
        <div className="relative">
          <button
            type="button"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded",
              "text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            )}
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          {/* Red badge */}
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
            3
          </span>
        </div>

        {/* Avatar */}
        <Avatar name="NS" size="sm" color="bg-emerald-600" />
      </div>
    </header>
  );
}
