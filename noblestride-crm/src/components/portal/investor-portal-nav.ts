// Shared nav model for the investor portal's CRM-style shell (sidebar +
// topbar). Pure data/functions so active-state and title derivation are
// unit-testable; icons stay in the sidebar component (client-only).

export const INVESTOR_NAV = [
  {
    href: "/portal/investor",
    label: "Opportunities",
    title: "Opportunities",
    subtitle: "Deals matching your mandate",
  },
  {
    href: "/portal/investor/pipeline",
    label: "My Pipeline",
    title: "My Pipeline",
    subtitle: "Your journey on each opportunity",
  },
  {
    href: "/portal/investor/dashboard",
    label: "Dashboard",
    title: "Dashboard",
    subtitle: "Your engagement across Noblestride deals",
  },
  {
    href: "/portal/investor/profile",
    label: "Fund Profile",
    title: "Fund Profile",
    subtitle: "Preferences that drive deal matching",
  },
  {
    href: "/portal/investor/team",
    label: "Team",
    title: "Team",
    subtitle: "Colleagues with access to this workspace",
  },
] as const;

export type InvestorNavItem = (typeof INVESTOR_NAV)[number];

/** Active on the item's route or a sub-route; deal pages belong to Opportunities. */
export function isInvestorNavActive(pathname: string, href: string): boolean {
  if (href === "/portal/investor") {
    return pathname === href || pathname.startsWith("/portal/investor/deals");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Topbar title/subtitle for the current investor-portal route. */
export function deriveInvestorPageMeta(pathname: string): {
  title: string;
  subtitle: string;
} {
  const item = INVESTOR_NAV.find((i) => isInvestorNavActive(pathname, i.href));
  return item
    ? { title: item.title, subtitle: item.subtitle }
    : { title: "Investor Portal", subtitle: "" };
}
