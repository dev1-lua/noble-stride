"use client";

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
  Search,
  FileText,
  Activity,
  ShieldCheck,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/cn";

// ─── Nav items ────────────────────────────────────────────────────────────────

const MAIN_NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, iconColor: "text-[var(--t-tag-text-emerald)]" },
  { href: "/deals", label: "Deals", Icon: Briefcase, iconColor: "text-[var(--t-tag-text-amber)]" },
  { href: "/clients", label: "Clients", Icon: Building, iconColor: "text-[var(--t-tag-text-blue)]" },
  { href: "/investors", label: "Investors", Icon: Users, iconColor: "text-[var(--t-tag-text-sky)]" },
  { href: "/engagement", label: "Engagement", Icon: MessageSquare, iconColor: "text-[var(--t-tag-text-violet)]" },
  { href: "/documents", label: "Documents", Icon: FileText, iconColor: "text-[var(--t-tag-text-orange)]" },
  { href: "/tasks", label: "Tasks", Icon: ListChecks, iconColor: "text-[var(--t-tag-text-blue)]" },
  { href: "/partners", label: "Partners", Icon: Building2, iconColor: "text-[var(--t-tag-text-violet)]" },
  { href: "/service-providers", label: "Service Providers", Icon: Scale, iconColor: "text-[var(--t-tag-text-gray)]" },
  { href: "/access-matrix", label: "Access Matrix", Icon: ShieldCheck, iconColor: "text-[var(--t-tag-text-rose)]" },
];

const AGENT_CARDS = [
  { label: "Overview", Icon: Activity, iconColor: "text-[var(--t-tag-text-emerald)]" },
  { label: "Prospecting", Icon: Search, iconColor: "text-[var(--t-tag-text-sky)]" },
  { label: "CRM", Icon: Users, iconColor: "text-[var(--t-tag-text-blue)]" },
  { label: "Notes", Icon: FileText, iconColor: "text-[var(--t-tag-text-orange)]" },
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
        <span className="text-sm font-bold text-[var(--text-primary)]">NobleStride</span>
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
  iconColor?: string;
}

// Shared base row classes for NavItem and the agent rows below.
const NAV_ROW_BASE = "relative flex items-center gap-3 rounded px-3 py-1.5 text-sm transition-colors";

export function NavItem({ href, label, Icon, active, iconColor }: NavItemProps) {
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
    </Link>
  );
}

// ─── Agent row ───────────────────────────────────────────────────────────────

function AgentRow({
  label,
  Icon,
  iconColor,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}) {
  return (
    <button type="button" className={cn(NAV_ROW_BASE, "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]")}>
      <Icon className={cn("h-4 w-4 flex-shrink-0", iconColor)} />
      {label}
    </button>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="flex flex-col w-64 flex-shrink-0 h-screen sticky top-0 overflow-hidden bg-[var(--bg-primary)] border-r border-[var(--border-subtle)]">
      {/* Brand */}
      <BrandMark />

      {/* Scrollable middle: MAIN nav + AGENTS */}
      <div className="flex-1 overflow-y-auto px-3 min-h-0">
        {/* MAIN section label */}
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
          Workspace
        </p>

        <nav className="flex flex-col gap-0.5">
          {MAIN_NAV.map(({ href, label, Icon, iconColor }) => (
            <NavItem key={href} href={href} label={label} Icon={Icon} active={isActive(href)} iconColor={iconColor} />
          ))}
        </nav>

        {/* AGENTS section */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Agents
            </p>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[9px] font-bold text-white">
              3
            </span>
          </div>
          {/* Agent rows, flattened to nav-style rows */}
          <div className="flex flex-col gap-0.5 pb-2">
            {AGENT_CARDS.map(({ label, Icon, iconColor }) => (
              <AgentRow key={label} label={label} Icon={Icon} iconColor={iconColor} />
            ))}
          </div>
        </div>
      </div>

      {/* Settings pinned at bottom */}
      <div className="flex-shrink-0 border-t border-[var(--border-subtle)] px-3 pt-2 pb-1">
        <button
          className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          type="button"
        >
          <Settings className="h-4 w-4 flex-shrink-0 text-[var(--text-tertiary)]" />
          Settings
        </button>
      </div>

      {/* Collapse chevron */}
      <div className="flex-shrink-0 flex items-center justify-center py-3 border-t border-[var(--border-subtle)]">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
