// partner-tabs.tsx — sub-navigation for the partner portal (Overview /
// Submit Referral / My Details). Client component only for usePathname;
// everything it links to is RSC.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/portal/partner", label: "Overview" },
  { href: "/portal/partner/refer", label: "Submit Referral" },
  { href: "/portal/partner/details", label: "My Details" },
] as const;

export function PartnerTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Partner portal"
      className="inline-flex w-fit gap-1 rounded-full border border-zinc-200 bg-white p-1"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={
              "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors " +
              (active
                ? "bg-emerald-950 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
