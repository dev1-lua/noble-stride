// Investor-portal sub-navigation: Opportunities / My Pipeline / Fund Profile.
// Client component only for usePathname() active-tab styling.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/portal/investor", label: "Opportunities" },
  { href: "/portal/investor/pipeline", label: "My Pipeline" },
  { href: "/portal/investor/profile", label: "Fund Profile" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/portal/investor") {
    return pathname === href || pathname.startsWith("/portal/investor/deals");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function InvestorNav() {
  const pathname = usePathname();
  return (
    <nav className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
      {TABS.map((tab) => {
        const active = isActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-md px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
