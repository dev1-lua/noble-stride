"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Building,
  TrendingUp,
  Users,
  MessageSquare,
  Building2,
  Scale,
  ChevronDown,
  FileText,
  ListChecks,
  UserCog,
  Send,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { SidebarProfile } from "./sidebar-profile";

// ─── Nav items ────────────────────────────────────────────────────────────────

const MAIN_NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, iconColor: "text-[var(--t-tag-text-emerald)]" },
  { href: "/deals", label: "Deals", Icon: Briefcase, iconColor: "text-[var(--t-tag-text-amber)]" },
  { href: "/clients", label: "Clients", Icon: Building, iconColor: "text-[var(--t-tag-text-blue)]" },
  { href: "/investors", label: "Investors", Icon: Users, iconColor: "text-[var(--t-tag-text-sky)]" },
  { href: "/investors/proposed-changes", label: "Investor Updates", Icon: UserCheck, iconColor: "text-[var(--t-tag-text-emerald)]" },
  { href: "/engagement", label: "Engagements", Icon: MessageSquare, iconColor: "text-[var(--t-tag-text-violet)]" },
  { href: "/outreach", label: "Outreach", Icon: Send, iconColor: "text-[var(--t-tag-text-rose)]" },
  { href: "/documents", label: "Documents", Icon: FileText, iconColor: "text-[var(--t-tag-text-orange)]" },
  { href: "/tasks", label: "Tasks", Icon: ListChecks, iconColor: "text-[var(--t-tag-text-blue)]" },
  { href: "/partners", label: "Partners", Icon: Building2, iconColor: "text-[var(--t-tag-text-violet)]" },
  { href: "/service-providers", label: "Service Providers", Icon: Scale, iconColor: "text-[var(--t-tag-text-gray)]" },
];

// Admin-only — rendered only when Sidebar receives isAdmin (real role, never
// the impersonation lens; see requireRealAdmin in settings/users/actions.ts).
const ADMIN_NAV_ITEM = {
  href: "/settings/users",
  label: "Users",
  Icon: UserCog,
  iconColor: "text-[var(--t-tag-text-gray)]",
};

// ─── Brand mark ───────────────────────────────────────────────────────────────

export function BrandMark() {
  return (
    <div className="flex items-center gap-3 px-4 py-5 flex-shrink-0">
      {/* Emerald rounded-square with trending-up glyph */}
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500">
        <TrendingUp className="h-5 w-5 text-white" strokeWidth={2.5} />
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-bold text-[var(--text-primary)]">Noblestride</span>
        <span className="text-xs text-[var(--text-tertiary)]">Capital</span>
      </div>
    </div>
  );
}

// ─── Nav item ────────────────────────────────────────────────────────────────

interface NavItemProps {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  active: boolean;
  badge?: number;
  iconColor?: string;
}

// Shared base row classes for NavItem.
const NAV_ROW_BASE = "relative flex items-center gap-3 rounded px-3 py-1.5 text-sm transition-colors";

export function NavItem({ href, label, Icon, active, badge, iconColor }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        NAV_ROW_BASE,
        active
          ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
      )}
    >
      <Icon
        className={cn("h-4 w-4 flex-shrink-0", active ? "text-[var(--accent)]" : iconColor ?? "text-[var(--text-tertiary)]")}
      />
      {label}
      {badge ? (
        <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold leading-none text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

// ─── Engagements nav group (expandable: By Deal / By Investor) ────────────────

function EngagementNavGroup({ active }: { active: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(active);
  const childActive = (href: string) => pathname === href;
  return (
    <div>
      {/* "Engagements" is a disclosure toggle only — clicking it opens/closes the
          sub-menu and never navigates. A page loads only when a child (By Deal /
          By Investor) is chosen. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          NAV_ROW_BASE,
          "w-full",
          active
            ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
        )}
      >
        <MessageSquare
          className={cn("h-4 w-4 flex-shrink-0", active ? "text-[var(--accent)]" : "text-[var(--t-tag-text-violet)]")}
        />
        Engagements
        <ChevronDown className={cn("ml-auto h-3.5 w-3.5 transition-transform", open ? "" : "-rotate-90")} />
      </button>
      {open && (
        <div className="ml-9 mt-0.5 flex flex-col gap-0.5">
          {[
            { href: "/engagement/deals", label: "By Deal" },
            { href: "/engagement/investors", label: "By Investor" },
          ].map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={cn(
                "rounded px-3 py-1.5 text-sm transition-colors",
                childActive(c.href)
                  ? "bg-[var(--bg-tertiary)] font-medium text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
              )}
            >
              {c.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function Sidebar({
  pendingReview = 0,
  isAdmin = false,
  userName = "",
  userEmail = "",
}: {
  pendingReview?: number;
  isAdmin?: boolean;
  userName?: string;
  userEmail?: string;
}) {
  const pathname = usePathname();
  const navItems = isAdmin ? [...MAIN_NAV, ADMIN_NAV_ITEM] : MAIN_NAV;

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="flex flex-col w-64 flex-shrink-0 h-screen sticky top-0 overflow-hidden bg-[var(--bg-primary)] border-r border-[var(--border-subtle)]">
      {/* Brand */}
      <BrandMark />

      {/* Scrollable middle: MAIN nav */}
      <div className="flex-1 overflow-y-auto px-3 min-h-0">
        {/* MAIN section label */}
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
          Workspace
        </p>

        <nav className="flex flex-col gap-0.5">
          {navItems.map(({ href, label, Icon, iconColor }) =>
            href === "/engagement" ? (
              <EngagementNavGroup key={href} active={isActive(href)} />
            ) : (
              <NavItem
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                active={isActive(href)}
                iconColor={iconColor}
                badge={href === "/investors" ? pendingReview : undefined}
              />
            ),
          )}
        </nav>
      </div>

      {/* Profile block — pinned footer, always visible. Click opens an
          upward logout dropdown (Task 7). */}
      <SidebarProfile name={userName} email={userEmail} />
    </aside>
  );
}
