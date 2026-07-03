// portal/partner/layout.tsx — nested layout adding the partner portal's
// sub-navigation (Overview / Submit Referral / My Details) inside the shared
// external-portal shell. Pages under it each gate on the partner viewpoint.
import { PartnerTabs } from "@/components/portal/partner-tabs";

export default function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PartnerTabs />
      {children}
    </div>
  );
}
