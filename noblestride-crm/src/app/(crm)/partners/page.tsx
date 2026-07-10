// partners/page.tsx — Partners list page.
// Server Component: stats counters + partners table + referral bar list.

import { listPartners, partnerReferralStats } from "@/server/services/partners";
import { StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { PartnerFormDrawer } from "@/components/crm/partner-form-drawer";
import { PartnersTable, type PartnerRowData } from "./partners-table";
import { getOrgLens } from "@/server/rbac/context";
import { can } from "@/server/rbac/matrix";

export default async function PartnersPage() {
  const lens = await getOrgLens();
  const [stats, partners] = await Promise.all([
    partnerReferralStats(),
    listPartners(),
  ]);

  // Build a lookup map from stats.byPartner (name → row) — both ordered name asc
  const statsByName = new Map(stats.byPartner.map((p) => [p.name, p]));

  // For bar chart: find max referred
  const maxReferred = Math.max(1, ...stats.byPartner.map((p) => p.referred));

  // Join partner + referral stats into flat, serializable rows for the client
  // <PartnersTable> (auth-enhancements Task 8, Point 2).
  const partnerRows: PartnerRowData[] = partners.map((partner) => {
    const row = statsByName.get(partner.name);
    return {
      id: partner.id,
      name: partner.name,
      partnerType: partner.partnerType,
      location: partner.location,
      referred: row?.referred ?? 0,
      active: row?.active ?? 0,
      closed: row?.closed ?? 0,
      revenue: row ? row.revenue : null,
    };
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Partners</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Referral partners, advisors, and deal sources
          </p>
        </div>
        <div className="flex gap-2">
          {can(lens.orgRole, "Partners", "C") && <PartnerFormDrawer mode="create" />}
        </div>
      </div>

      {/* Counters strip — 4 tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Partners" value={String(stats.totalPartners)} />
        <StatCard label="Deals Referred" value={String(stats.dealsReferred)} />
        <StatCard label="Closed Revenue" value={formatMoney(stats.closedRevenue)} />
        <StatCard
          label="Conversion Rate"
          value={`${Math.round(stats.conversionRate * 100)}%`}
        />
      </div>

      {/* Partners table */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
          Partner Directory
        </h2>
        <PartnersTable partners={partnerRows} />
      </div>

      {/* Referrals by Partner — CSS bar list */}
      {stats.byPartner.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
            Referrals by Partner
          </h2>
          <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
            {stats.byPartner.map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="w-36 flex-shrink-0 text-xs font-medium text-[var(--text-secondary)] truncate">
                  {p.name}
                </span>
                <div className="flex-1 bg-[var(--bg-tertiary)] rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: `${Math.round((p.referred / maxReferred) * 100)}%` }}
                  />
                </div>
                <span className="w-6 flex-shrink-0 text-xs text-[var(--text-tertiary)] text-right">
                  {p.referred}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
