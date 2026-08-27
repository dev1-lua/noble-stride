// portal/investor/pipeline — the investor's OWN journey across deals.
// Everything rendered here came out of loadInvestorPipeline (visibility
// engine): own stage/milestones/lastContact/termSheet only — never internal
// feedback, probability, notes, amounts, owners or other investors.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadInvestorPipeline } from "@/server/visibility";
import { getViewpoint } from "@/server/viewpoint";
import { label } from "@/lib/vocab";
import { INVESTOR_VISIBLE_MILESTONES } from "@/lib/milestones";
import { MilestoneStepper } from "@/components/portal/milestone-stepper";
import { Card, CardBody } from "@/components/ui/card";
import { portalStatusLabel, type PortalDealStatusLabel } from "@/server/domain/access-state";
import { getBoolSetting } from "@/server/services/app-settings";
import { getPortalMembership } from "@/server/auth/portal-authz";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// F6b.2 (§2c Aika vocabulary): the fund reads its own position without being
// shown the internal stage enum. Amber is "we are waiting on Noblestride".
const STATUS_TONE: Record<PortalDealStatusLabel, string> = {
  "Shared with you": "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]",
  "Awaiting access": "bg-[var(--t-tag-bg-amber)] text-[var(--t-tag-text-amber)]",
  "Access granted": "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]",
  "NDA signed": "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]",
  "In discussion": "bg-[var(--t-tag-bg-sky)] text-[var(--t-tag-text-sky)]",
  Closed: "bg-[var(--t-tag-bg-violet)] text-[var(--t-tag-text-violet)]",
  Declined: "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]",
};

export default async function InvestorPipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ declined?: string; mine?: string }>;
}) {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");

  const { declined: justDeclined, mine } = await searchParams;
  // F6b.4 (image31): "Only deals I follow" — participants plus, by definition,
  // the fund's primary contact.
  const membership = await getPortalMembership();
  const onlyMine = mine === "1";
  const items = await loadInvestorPipeline(prisma, vp.recordId, {
    personId: membership?.personId,
    onlyMine,
  });
  // F6b.3 / G3: the milestone stepper is opt-in per org; the status chip above
  // is what every fund sees by default.
  const showMilestones = await getBoolSetting("portal.deal.milestones");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Pipeline</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          {showMilestones
            ? `Your fund's progress on each opportunity — the ${INVESTOR_VISIBLE_MILESTONES.length}-step Noblestride investment cycle from teaser review to completion.`
            : "Where your fund stands on each opportunity. Open a deal to talk to the Noblestride team about it."}
        </p>
      </div>

      <div className="flex gap-1.5" role="tablist" aria-label="Pipeline view">
        {(
          [
            { href: "/portal/investor/pipeline", label: "All our deals", active: !onlyMine, id: "all" },
            { href: "/portal/investor/pipeline?mine=1", label: "Only deals I follow", active: onlyMine, id: "mine" },
          ] as const
        ).map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={tab.active}
            data-testid={`pipeline-tab-${tab.id}`}
            className={
              "rounded-md px-3 py-1.5 text-xs font-medium " +
              (tab.active
                ? "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]"
                : "border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]")
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {justDeclined && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--t-tag-bg-gray)] px-4 py-3 text-sm text-[var(--t-tag-text-gray)]">
          You&apos;ve withdrawn from the deal. It stays in your history below; the Noblestride team
          has been notified.
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <CardBody className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              {onlyMine ? "You are not following any deals yet." : "No active engagements yet."}
            </p>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
              {onlyMine
                ? "An editor on your team can add you as a participant on a deal."
                : "Express interest on an opportunity to start your journey."}
            </p>
            <Link
              href="/portal/investor"
              className="mt-4 inline-block rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
            >
              Browse opportunities
            </Link>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map(({ deal, own, isParticipant }) => {
            const declined = own.stage === "Declined";
            const statusLabel = portalStatusLabel({ stage: own.stage, status: own.status });
            return (
              <Link
                key={deal.id}
                href={`/portal/investor/deals/${deal.id}`}
                className={`block rounded-lg border border-[var(--border-strong)] bg-[var(--bg-primary)] p-5 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--accent)] ${
                  declined ? "opacity-60" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[var(--text-primary)]">{deal.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {deal.companyProfile.sector.slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-[var(--t-tag-bg-gray)] px-2 py-0.5 text-xs font-medium text-[var(--t-tag-text-gray)]"
                        >
                          {label("Sector", s)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span
                    data-testid={`pipeline-status-${deal.id}`}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[statusLabel]}`}
                    title={label("EngagementStage", own.stage)}
                  >
                    {statusLabel}
                  </span>
                  {isParticipant && (
                    <span
                      data-testid="participant-chip"
                      className="rounded-full bg-[var(--t-tag-bg-sky)] px-2.5 py-0.5 text-xs font-medium text-[var(--t-tag-text-sky)]"
                    >
                      I follow this
                    </span>
                  )}
                </div>

                {showMilestones && (
                  <div className="mt-4" data-testid={`pipeline-stepper-${deal.id}`}>
                    <MilestoneStepper completedKeys={own.milestoneKeys} muted={declined} />
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--text-tertiary)]">
                  {showMilestones && (
                    <span>
                      <span className="font-semibold text-[var(--text-secondary)]">
                        {own.milestoneKeys.length} of {INVESTOR_VISIBLE_MILESTONES.length}
                      </span>{" "}
                      milestones
                    </span>
                  )}
                  <span>
                    Last contact:{" "}
                    {own.lastContact ? DATE_FMT.format(own.lastContact) : "—"}
                  </span>
                  {own.termSheetIssued && (
                    <span className="font-medium text-[var(--accent-hover)]">
                      Term sheet issued
                      {own.termSheetDate ? ` · ${DATE_FMT.format(own.termSheetDate)}` : ""}
                    </span>
                  )}
                  {!declined && (
                    <span className="ml-auto font-medium text-[var(--accent-hover)]">
                      Act on this deal →
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
