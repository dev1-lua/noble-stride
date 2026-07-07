"use client";

// CRM-style sidebar for the investor portal — same visual system as the
// internal shell sidebar (dark emerald, brand mark, accented nav), but
// external-safe: portal-only nav, no internal routes, no agent cards.
// h-full instead of h-screen: the demo-lens banner sits above it in the
// investor layout's flex column.
import { usePathname } from "next/navigation";
import { LayoutGrid, TrendingUp, BarChart3, Building2, ChevronLeft } from "lucide-react";
import { BrandMark, NavItem, SIDEBAR_FG } from "@/components/shell/sidebar";
import { INVESTOR_NAV, isInvestorNavActive } from "./investor-portal-nav";

const NAV_ICONS = {
  "/portal/investor": LayoutGrid,
  "/portal/investor/pipeline": TrendingUp,
  "/portal/investor/dashboard": BarChart3,
  "/portal/investor/profile": Building2,
} as const;

export function InvestorSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex h-full w-64 flex-shrink-0 flex-col overflow-hidden"
      style={{ backgroundColor: "#0b1a14" }}
    >
      <BrandMark />

      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        <p
          className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest opacity-60"
          style={{ color: SIDEBAR_FG }}
        >
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
            />
          ))}
        </nav>
      </div>

      <div className="flex-shrink-0 border-t border-white/5 px-4 py-3">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest opacity-60"
          style={{ color: SIDEBAR_FG }}
        >
          Investor Portal
        </p>
      </div>

      <div className="flex flex-shrink-0 items-center justify-center border-t border-white/5 py-3">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/5"
          style={{ color: SIDEBAR_FG }}
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
