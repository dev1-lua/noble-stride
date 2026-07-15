// portal/investor/page.tsx — investor discovery list (design spec §5.3).
// Everything rendered here came out of the visibility projector; this page
// never touches raw records.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadInvestorPortalData, parseOpportunityFilters } from "@/server/visibility";
import { getViewpoint } from "@/server/viewpoint";
import { label } from "@/lib/vocab";
import { formatMoney } from "@/lib/money";
import { TierBadge } from "@/components/portal/tier-badge";
import { OpportunityFilters } from "@/components/portal/opportunity-filters";
import { Card, CardBody } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function InvestorPortalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");

  const filters = parseOpportunityFilters(await searchParams);
  const filtering = Object.keys(filters).length > 0;
  const { investor, deals } = await loadInvestorPortalData(prisma, vp.recordId, filters);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Investment Opportunities</h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Prepared for <span className="font-medium text-[var(--text-secondary)]">{investor.name}</span> — showing
          opportunities matching your mandate
        </p>
      </div>

      <OpportunityFilters />
      <p className="text-xs text-[var(--text-tertiary)]">
        {deals.length} opportunit{deals.length === 1 ? "y" : "ies"} match
      </p>

      {deals.length === 0 ? (
        <Card>
          <CardBody className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              {filtering
                ? "No opportunities match your filters."
                : "No opportunities available right now."}
            </p>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
              {filtering
                ? "Try widening or clearing the filters above."
                : "Please contact your Noblestride advisor for more information."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal) => (
            <Link
              key={deal.id}
              href={`/portal/investor/deals/${deal.id}`}
              className="group rounded-lg border border-[var(--border-strong)] bg-[var(--bg-primary)] p-5 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--accent)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-hover)]">
                  {deal.name}
                </div>
                <TierBadge tier={deal.tier} />
              </div>
              <div className="mt-1 text-sm text-[var(--text-tertiary)]">{deal.companyProfile.clientName}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {deal.companyProfile.womenLed && (
                  <span className="rounded-full bg-[var(--t-tag-bg-gray)] px-2 py-0.5 text-xs font-medium text-[var(--t-tag-text-gray)]">
                    Women-led
                  </span>
                )}
                {deal.companyProfile.youthLed && (
                  <span className="rounded-full bg-[var(--t-tag-bg-gray)] px-2 py-0.5 text-xs font-medium text-[var(--t-tag-text-gray)]">
                    Youth-led
                  </span>
                )}
                {deal.companyProfile.sector.slice(0, 3).map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-[var(--t-tag-bg-gray)] px-2 py-0.5 text-xs font-medium text-[var(--t-tag-text-gray)]"
                  >
                    {label("Sector", s)}
                  </span>
                ))}
                {deal.dealTypeTicket.instrument.map((i) => (
                  <span
                    key={i}
                    className="rounded-full bg-[var(--t-tag-bg-gray)] px-2 py-0.5 text-xs font-medium text-[var(--t-tag-text-gray)]"
                  >
                    {label("Instrument", i)}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-[var(--text-tertiary)]">Target raise</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {deal.dealTypeTicket.targetRaise != null
                    ? formatMoney(deal.dealTypeTicket.targetRaise, deal.dealTypeTicket.currency)
                    : "On request"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
