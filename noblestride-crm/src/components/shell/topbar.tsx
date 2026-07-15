"use client";

import { usePathname } from "next/navigation";
import { AskBar } from "./ask-bar";
import { NotificationBell, type NotificationItem } from "./notification-bell";
import { HelpPanel } from "./help-panel";
import { CommandPalette } from "@/components/search/command-palette";

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
    subtitle: "Who sees what inside Noblestride",
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
  return { title: title || "Noblestride", subtitle: "" };
}

// ─── Topbar ──────────────────────────────────────────────────────────────────

export function Topbar({
  notifications = [],
  notificationCount = 0,
}: {
  notifications?: NotificationItem[];
  notificationCount?: number;
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

        {/* Global search (Task 3/D) — Cmd/Ctrl-K command palette */}
        <CommandPalette />

        {/* Notification bell (Task 14) — server-fetched initial data, no polling */}
        <NotificationBell initialItems={notifications} initialCount={notificationCount} />
      </div>
    </header>
  );
}
