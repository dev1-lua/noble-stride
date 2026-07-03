// Investor-scoped layout — nests inside the outer portal shell and adds the
// investor sub-navigation (Opportunities / My Pipeline / Fund Profile).
import { InvestorNav } from "@/components/portal/investor-nav";

export default function InvestorPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <InvestorNav />
      {children}
    </div>
  );
}
