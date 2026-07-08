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
  Settings,
  ChevronLeft,
  ChevronDown,
  Search,
  FileText,
  Activity,
  ShieldCheck,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/cn";

// sidebar foreground color — Tailwind v4 CSS-var arbitrary syntax
export const SIDEBAR_FG = "#cbd5cf"; // --color-sidebar-fg

// ─── Nav items ────────────────────────────────────────────────────────────────

const MAIN_NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/deals", label: "Deals", Icon: Briefcase },
  { href: "/clients", label: "Clients", Icon: Building },
  { href: "/investors", label: "Investors", Icon: Users },
  { href: "/engagement", label: "Engagement", Icon: MessageSquare },
  { href: "/documents", label: "Documents", Icon: FileText },
  { href: "/tasks", label: "Tasks", Icon: ListChecks },
  { href: "/partners", label: "Partners", Icon: Building2 },
  { href: "/service-providers", label: "Service Providers", Icon: Scale },
  { href: "/access-matrix", label: "Access Matrix", Icon: ShieldCheck },
];

const AGENT_CARDS = [
  { label: "Overview", Icon: Activity },
  { label: "Prospecting", Icon: Search },
  { label: "CRM", Icon: Users },
  { label: "Notes", Icon: FileText },
];

// ─── Brand mark ───────────────────────────────────────────────────────────────

export function BrandMark() {
  return (
    <div className="flex items-center gap-3 px-4 py-5 flex-shrink-0">
      {/* Emerald rounded-square with trending-up glyph */}
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500">
        <TrendingUp className="h-5 w-5 text-white" strokeWidth={2.5} />
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-bold text-white">NobleStride</span>
        <span className="text-xs" style={{ color: SIDEBAR_FG }}>
          Capital
        </span>
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
}

export function NavItem({ href, label, Icon, active, badge }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-white/10 font-medium"
          : "hover:bg-white/5"
      )}
      style={{ color: active ? "#ffffff" : SIDEBAR_FG }}
    >
      {/* Left accent bar for active */}
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-emerald-400" />
      )}
      <Icon
        className="h-4 w-4 flex-shrink-0"
        style={{ color: active ? "#34d399" : SIDEBAR_FG }}
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

// ─── Engagement nav group (expandable: By Deal / By Investor) ────────────────

function EngagementNavGroup({ active }: { active: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(active);
  const childActive = (href: string) => pathname === href;
  return (
    <div>
      {/* "Engagement" is a disclosure toggle only — clicking it opens/closes the
          sub-menu and never navigates. A page loads only when a child (By Deal /
          By Investor) is chosen. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
          active ? "bg-white/10 font-medium" : "hover:bg-white/5",
        )}
        style={{ color: active ? "#ffffff" : SIDEBAR_FG }}
      >
        {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-emerald-400" />}
        <MessageSquare className="h-4 w-4 flex-shrink-0" style={{ color: active ? "#34d399" : SIDEBAR_FG }} />
        Engagement
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
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                childActive(c.href) ? "bg-white/10 font-medium text-white" : "hover:bg-white/5",
              )}
              style={{ color: childActive(c.href) ? "#ffffff" : SIDEBAR_FG }}
            >
              {c.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({
  label,
  Icon,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg bg-white/5 p-2.5 cursor-default hover:bg-white/10 transition-colors">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/20">
        <Icon className="h-3.5 w-3.5 text-emerald-400" />
      </span>
      <span className="text-[10px] font-medium leading-none" style={{ color: SIDEBAR_FG }}>
        {label}
      </span>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function Sidebar({ pendingReview = 0 }: { pendingReview?: number }) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside
      className="flex flex-col w-64 flex-shrink-0 h-screen sticky top-0 overflow-hidden"
      style={{ backgroundColor: "#0b1a14" }}
    >
      {/* Brand */}
      <BrandMark />

      {/* Scrollable middle: MAIN nav + AGENTS */}
      <div className="flex-1 overflow-y-auto px-3 min-h-0">
        {/* MAIN section label */}
        <p
          className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest opacity-60"
          style={{ color: SIDEBAR_FG }}
        >
          Main
        </p>

        <nav className="flex flex-col gap-0.5">
          {MAIN_NAV.map(({ href, label, Icon }) =>
            href === "/engagement" ? (
              <EngagementNavGroup key={href} active={isActive(href)} />
            ) : (
              <NavItem
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                active={isActive(href)}
                badge={href === "/investors" ? pendingReview : undefined}
              />
            ),
          )}
        </nav>

        {/* AGENTS section */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between px-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-widest opacity-60"
              style={{ color: SIDEBAR_FG }}
            >
              Agents
            </p>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
              3
            </span>
          </div>
          {/* 2×2 agent card grid */}
          <div className="grid grid-cols-2 gap-2 pb-2">
            {AGENT_CARDS.map(({ label, Icon }) => (
              <AgentCard key={label} label={label} Icon={Icon} />
            ))}
          </div>
        </div>
      </div>

      {/* Settings pinned at bottom */}
      <div className="flex-shrink-0 border-t border-white/5 px-3 pt-2 pb-1">
        <button
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-white/5 transition-colors"
          style={{ color: SIDEBAR_FG }}
          type="button"
        >
          <Settings className="h-4 w-4 flex-shrink-0" style={{ color: SIDEBAR_FG }} />
          Settings
        </button>
      </div>

      {/* Collapse chevron */}
      <div className="flex-shrink-0 flex items-center justify-center py-3 border-t border-white/5">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/5 transition-colors"
          style={{ color: SIDEBAR_FG }}
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
