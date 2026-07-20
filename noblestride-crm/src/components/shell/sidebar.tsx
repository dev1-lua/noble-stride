"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
  Bot,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { SidebarProfile } from "./sidebar-profile";

// ─── Nav items ────────────────────────────────────────────────────────────────

const MAIN_NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, iconColor: "text-[var(--t-tag-text-emerald)]" },
  { href: "/deals", label: "Deals", Icon: Briefcase, iconColor: "text-[var(--t-tag-text-amber)]" },
  { href: "/clients", label: "Clients", Icon: Building, iconColor: "text-[var(--t-tag-text-blue)]" },
  { href: "/investors", label: "Investors", Icon: Users, iconColor: "text-[var(--t-tag-text-sky)]" },
  { href: "/engagement", label: "Engagements", Icon: MessageSquare, iconColor: "text-[var(--t-tag-text-violet)]" },
  { href: "/documents", label: "Documents", Icon: FileText, iconColor: "text-[var(--t-tag-text-orange)]" },
  { href: "/tasks", label: "Tasks", Icon: ListChecks, iconColor: "text-[var(--t-tag-text-blue)]" },
  { href: "/partners", label: "Partners", Icon: Building2, iconColor: "text-[var(--t-tag-text-violet)]" },
  { href: "/service-providers", label: "Service Providers", Icon: Scale, iconColor: "text-[var(--t-tag-text-gray)]" },
];

// Agents pinned to the sidebar footer block (wireframe-style quick links to
// the staff Lua webchat agents). Not part of MAIN_NAV — rendered as a
// separate 2-column grid between the scrollable workspace nav and the
// profile footer.
const AGENT_NAV = [
  { href: "/assistant", label: "Assistant", Icon: Bot, iconColor: "text-[var(--t-tag-text-emerald)]" },
  { href: "/assistant?agent=tracker", label: "Investor Tracker", Icon: TrendingUp, iconColor: "text-[var(--t-tag-text-sky)]" },
  { href: "/investors/proposed-changes", label: "Investor Updates", Icon: UserCheck, iconColor: "text-[var(--t-tag-text-emerald)]" },
  { href: "/outreach", label: "Outreach", Icon: Send, iconColor: "text-[var(--t-tag-text-rose)]" },
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

// ─── Agents grid (pinned, wireframe-style quick links) ────────────────────────

interface AgentCardProps {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  iconColor?: string;
  badge?: number;
}

function AgentCard({ href, label, Icon, active, iconColor, badge }: AgentCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-md border border-transparent bg-[var(--bg-tertiary)] px-2 py-2.5 text-center transition-colors",
        active
          ? "border-[var(--accent)] text-[var(--text-primary)] font-medium"
          : "text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)]"
      )}
    >
      {badge ? (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold leading-none text-white">
          {badge}
        </span>
      ) : null}
      <Icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-[var(--accent)]" : iconColor ?? "text-[var(--text-tertiary)]")} />
      <span className="text-[11px] leading-tight">{label}</span>
    </Link>
  );
}

function AgentsNav({ pendingChanges }: { pendingChanges: number }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const isTracker = search?.get("agent") === "tracker";
  const onAssistant = pathname.startsWith("/assistant");

  function isActive(href: string) {
    if (href === "/assistant") return onAssistant && !isTracker;
    if (href === "/assistant?agent=tracker") return onAssistant && isTracker;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="border-t border-[var(--border-subtle)] px-3 pb-3 pt-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
          Agents
        </p>
        <span className="rounded-full bg-[var(--bg-tertiary)] px-1.5 text-[10px] font-semibold text-[var(--text-secondary)]">
          {AGENT_NAV.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {AGENT_NAV.map(({ href, label, Icon, iconColor }) => (
          <AgentCard
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            active={isActive(href)}
            iconColor={iconColor}
            badge={href === "/investors/proposed-changes" ? pendingChanges : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function Sidebar({
  pendingReview = 0,
  pendingChanges = 0,
  isAdmin = false,
  userName = "",
  userEmail = "",
}: {
  /** Investors awaiting onboarding approval — Investors row badge. */
  pendingReview?: number;
  /** Agent-captured profile updates awaiting confirmation — Investor Updates card badge. */
  pendingChanges?: number;
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

      {/* Agents — pinned quick-link grid to the staff Lua webchat agents. */}
      <AgentsNav pendingChanges={pendingChanges} />

      {/* Profile block — pinned footer, always visible. Click opens an
          upward logout dropdown (Task 7). */}
      <SidebarProfile name={userName} email={userEmail} />
    </aside>
  );
}
