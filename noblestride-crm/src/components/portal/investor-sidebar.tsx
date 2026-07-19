"use client";

// CRM-style sidebar for the investor portal — same visual system as the
// internal shell sidebar (light Twenty-style panel, brand mark, accented
// nav), but external-safe: portal-only nav, no internal routes, no agent
// cards.
// h-full instead of h-screen: the demo-lens banner sits above it in the
// investor layout's flex column.
import { usePathname } from "next/navigation";
import { LayoutGrid, TrendingUp, BarChart3, Building2, Users } from "lucide-react";
import { BrandMark, NavItem } from "@/components/shell/sidebar";
import { SidebarProfile } from "@/components/shell/sidebar-profile";
import { INVESTOR_NAV, isInvestorNavActive } from "./investor-portal-nav";

const NAV_ICONS = {
  "/portal/investor": LayoutGrid,
  "/portal/investor/pipeline": TrendingUp,
  "/portal/investor/dashboard": BarChart3,
  "/portal/investor/profile": Building2,
  "/portal/investor/team": Users,
} as const;

const NAV_ICON_COLORS = {
  "/portal/investor": "text-[var(--t-tag-text-emerald)]",
  "/portal/investor/pipeline": "text-[var(--t-tag-text-amber)]",
  "/portal/investor/dashboard": "text-[var(--t-tag-text-sky)]",
  "/portal/investor/profile": "text-[var(--t-tag-text-violet)]",
  "/portal/investor/team": "text-[var(--t-tag-text-rose)]",
} as const;

export function InvestorSidebar({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-shrink-0 flex-col overflow-hidden bg-[var(--bg-primary)] border-r border-[var(--border-subtle)]">
      <BrandMark />

      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
          Portal
        </p>
        <nav className="flex flex-col gap-0.5">
          {INVESTOR_NAV.map(({ href, label }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              Icon={NAV_ICONS[href]}
              active={isInvestorNavActive(pathname, href)}
              iconColor={NAV_ICON_COLORS[href]}
            />
          ))}
        </nav>
      </div>

      {/* Profile block — pinned footer, always visible. Click opens an
          upward logout dropdown (Task 7). */}
      <SidebarProfile name={name} email={email} />
    </aside>
  );
}
