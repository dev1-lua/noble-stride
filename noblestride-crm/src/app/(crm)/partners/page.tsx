// partners/page.tsx — Partners list page.
// Server Component: stats counters + partners table + referral bar list.

import Link from "next/link";
import { listPartners, partnerReferralStats } from "@/server/services/partners";
import { StatCard, Chip, Table, THead, TBody, Tr, Th, Td } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { PartnerFormDrawer } from "@/components/crm/partner-form-drawer";

export default async function PartnersPage() {
  const [stats, partners] = await Promise.all([
    partnerReferralStats(),
    listPartners(),
  ]);

  // Build a lookup map from stats.byPartner (name → row) — both ordered name asc
  const statsByName = new Map(stats.byPartner.map((p) => [p.name, p]));

  // For bar chart: find max referred
  const maxReferred = Math.max(1, ...stats.byPartner.map((p) => p.referred));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Partners</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Referral partners, advisors, and deal sources
          </p>
        </div>
        <div className="flex gap-2">
          <PartnerFormDrawer mode="create" />
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
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide mb-3">
          Partner Directory
        </h2>
        <Table>
          <THead>
            <Tr>
              <Th>Partner</Th>
              <Th>Type</Th>
              <Th>Location</Th>
              <Th>Referred</Th>
              <Th>Active</Th>
              <Th>Closed</Th>
              <Th>Revenue</Th>
            </Tr>
          </THead>
          <TBody>
            {partners.map((partner) => {
              const row = statsByName.get(partner.name);
              return (
                <Tr key={partner.id}>
                  <Td>
                    <Link
                      href={`/partners/${partner.id}`}
                      className="font-medium text-zinc-900 hover:text-accent transition-colors"
                    >
                      {partner.name}
                    </Link>
                  </Td>
                  <Td>
                    {partner.partnerType ? (
                      <Chip value={partner.partnerType} group="PartnerType" />
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </Td>
                  <Td>
                    <span className="text-zinc-600">{partner.location ?? "—"}</span>
                  </Td>
                  <Td>{row?.referred ?? 0}</Td>
                  <Td>{row?.active ?? 0}</Td>
                  <Td>{row?.closed ?? 0}</Td>
                  <Td>{row ? formatMoney(row.revenue) : "—"}</Td>
                </Tr>
              );
            })}
            {partners.length === 0 && (
              <Tr>
                <Td colSpan={7}>
                  <span className="text-zinc-400">No partners on record.</span>
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
      </div>

      {/* Referrals by Partner — CSS bar list */}
      {stats.byPartner.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide mb-3">
            Referrals by Partner
          </h2>
          <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4">
            {stats.byPartner.map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="w-36 flex-shrink-0 text-xs font-medium text-zinc-700 truncate">
                  {p.name}
                </span>
                <div className="flex-1 bg-zinc-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: `${Math.round((p.referred / maxReferred) * 100)}%` }}
                  />
                </div>
                <span className="w-6 flex-shrink-0 text-xs text-zinc-500 text-right">
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
