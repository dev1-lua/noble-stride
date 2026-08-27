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
import { ExpressInterestForm } from "@/components/portal/express-interest-form";
import { getPortalMembership, capabilitiesOf } from "@/server/auth/portal-authz";
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
  // The mandate tab is not a "filter" for the empty-state copy — it is a view.
  const filtering = Object.keys(filters).filter((k) => k !== "match").length > 0;
  const { investor, deals } = await loadInvestorPortalData(prisma, vp.recordId, filters);
  // F6b.1: both tab counts, so the strip can show them without a second render.
  const matchCount = filters.match
    ? deals.length
    : deals.filter((d) => d.matchesMandate).length;
  const browseCount = filters.match
    ? (await loadInvestorPortalData(prisma, vp.recordId, { ...filters, match: undefined })).deals.length
    : deals.length;

  // Seat gate (item 3): expressing interest commits the org, so Viewers get the
  // explanation rather than the button. expressInterest re-checks server-side.
  const membership = await getPortalMembership();
  const canEdit = membership ? capabilitiesOf(membership).canEdit : false;
  // Deals this fund has already registered interest in — so a card offers the
  // action once and reports it thereafter.
  const registered = new Set(
    (
      await prisma.engagement.findMany({
        where: { investorId: vp.recordId, status: { notIn: ["NotContacted", "Contacted"] } },
        select: { transactionId: true },
      })
    ).map((e) => e.transactionId),
  );

  // Switching tabs keeps whatever filters are applied; only ?match changes.
  const tabHref = (match: boolean): string => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (key === "match" || value == null) continue;
      next.set(key, Array.isArray(value) ? value.join(",") : String(value));
    }
    if (match) next.set("match", "1");
    const qs = next.toString();
    return qs ? `/portal/investor?${qs}` : "/portal/investor";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Investment Opportunities</h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Every live opportunity — filter, then register your interest. Prepared for{" "}
          <span className="font-medium text-[var(--text-secondary)]">{investor.name}</span>.
        </p>
      </div>

      {/* F6b.1: the client asked that investors see ALL deals; the mandate
          match becomes a view rather than a hard filter. */}
      <div className="flex gap-1.5" role="tablist" aria-label="Opportunity view">
        <Link
          href={tabHref(false)}
          data-testid="portal-tab-browse"
          aria-selected={!filters.match}
          role="tab"
          className={
            "rounded-md px-3 py-1.5 text-xs font-medium " +
            (!filters.match
              ? "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]"
              : "border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]")
          }
        >
          Browse all ({browseCount})
        </Link>
        <Link
          href={tabHref(true)}
          data-testid="portal-tab-match"
          aria-selected={Boolean(filters.match)}
          role="tab"
          className={
            "rounded-md px-3 py-1.5 text-xs font-medium " +
            (filters.match
              ? "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]"
              : "border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]")
          }
        >
          Matches my mandate ({matchCount})
        </Link>
      </div>

      <OpportunityFilters />
      <p className="text-xs text-[var(--text-tertiary)]">
        {deals.length} opportunit{deals.length === 1 ? "y" : "ies"}
      </p>

      {deals.length === 0 ? (
        <Card>
          <CardBody className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              {filtering
                ? "No opportunities match your filters."
                : filters.match
                  ? "Nothing currently matches your mandate."
                  : "No opportunities available right now."}
            </p>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
              {filtering
                ? "Try widening or clearing the filters above."
                : filters.match
                  ? "Browse all opportunities, or update your fund profile so we can match you better."
                  : "Please contact your Noblestride advisor for more information."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal) => (
            <div
              key={deal.id}
              className="group flex flex-col rounded-lg border border-[var(--border-strong)] bg-[var(--bg-primary)] p-5 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--accent)]"
            >
              <Link href={`/portal/investor/deals/${deal.id}`} className="block">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-hover)]">
                  {deal.name}
                </div>
                <TierBadge tier={deal.tier} />
              </div>
              <div className="mt-1 text-sm text-[var(--text-tertiary)]">{deal.companyProfile.clientName}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {deal.matchesMandate && (
                  <span
                    data-testid={`match-chip-${deal.id}`}
                    className="rounded-full bg-[var(--t-tag-bg-emerald)] px-2 py-0.5 text-xs font-medium text-[var(--t-tag-text-emerald)]"
                  >
                    Matches your mandate
                  </span>
                )}
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

              {/* Outside the <Link>: a form nested in an anchor is invalid and
                  would swallow the clicks. */}
              {canEdit ? (
                <ExpressInterestForm
                  dealId={deal.id}
                  returnTo="/portal/investor"
                  registered={registered.has(deal.id)}
                />
              ) : (
                <p className="mt-3 text-xs text-[var(--text-tertiary)]">
                  Ask an editor on your team to register interest.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
