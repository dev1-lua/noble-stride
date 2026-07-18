// dashboard/page.tsx — RSC Dashboard page.
// Calls services directly (NOT urql). No "use client".

import { Target, Briefcase, Users, DollarSign, ClipboardCheck, CheckCircle2, FileCheck2, AlertTriangle } from "lucide-react";
import {
  dashboardStats,
  pipelineOverview,
  pipelineBreakdowns,
  dealPipelineTrend,
  onboardingStats,
  pendingOnboardingInvestors,
  intakeAwaitingReviewCount,
  teamWorkload,
  taskStatusByOwner,
  overdueTasksCount,
  overdueTasks,
  pipelineActiveSplit,
  stageChangeFeed,
  stageChangeCounts,
  investorEngagementRollup,
  investedSummary,
  historicalEngagementSummary,
  partnerConversionFunnel,
  disbursementByPeriod,
} from "@/server/services/dashboard";
import { aiOverviewInsights } from "@/server/services/ai";
import { Card, CardHeader, CardBody } from "@/components/ui";
import { AnimatedStatCard } from "@/components/ui/animated-stat-card";
import { Reveal, Stagger } from "@/components/ui/motion";
import { OverviewAgentCard } from "@/components/crm/overview-agent-card";
import { OnboardingQueueCard } from "@/components/crm/onboarding-queue-card";
import { IntakeQueueCallout } from "@/components/crm/intake-queue-callout";
import { DealPipelineTrendChart, PipelineOverviewChart } from "@/components/crm/pipeline-chart";
import { BreakdownBarList } from "@/components/crm/pipeline-breakdown";
import { TeamWorkloadTable, TaskStatusCrosstab, OverdueActionsList } from "@/components/crm/team-tasks-panel";
import {
  StageChangeFeedList,
  InvestorRollupTable,
  HistoricalEngagementTable,
  PartnerFunnelTable,
} from "@/components/crm/deal-analytics-panels";
import { DisbursementPeriodChart } from "@/components/crm/disbursement-period-chart";
import { ACTIVE_MANDATE_STAGES, ACTIVE_TXN_STAGES } from "@/server/domain/types";
import type { BreakdownRow } from "@/components/crm/pipeline-breakdown";

// ── Drilldown link builders ─────────────────────────────────────────────────
// Every dashboard number links to a /deals (or /investors) view whose filter
// reproduces the metric's exact definition, so the count on the card equals
// the row count on the list it opens. "Active" is a STAGE set (not dealStatus)
// for the top stats and breakdowns — passed explicitly via ?stage=.

const ACTIVE_MANDATES_HREF = `/deals?type=mandate&stage=${ACTIVE_MANDATE_STAGES.join(",")}`;
const ACTIVE_TXNS_HREF = `/deals?type=transaction&stage=${ACTIVE_TXN_STAGES.join(",")}`;

/** Attach a /deals drilldown to breakdown rows (all scoped to active transactions). */
function linkBreakdown(rows: BreakdownRow[], param: string, opts?: { byLabel?: boolean; skipKeys?: string[] }): BreakdownRow[] {
  const skip = new Set(opts?.skipKeys ?? ["none", "unassigned"]);
  return rows.map((r) =>
    skip.has(r.key)
      ? r
      : { ...r, href: `${ACTIVE_TXNS_HREF}&${param}=${encodeURIComponent(opts?.byLabel ? r.label : r.key)}` },
  );
}

export default async function DashboardPage() {
  const [
    s,
    insights,
    pipeline,
    breakdowns,
    trend,
    onboarding,
    pendingOnboarding,
    intakeAwaitingReview,
    workload,
    statusByOwner,
    overdueCount,
    overdueList,
    activeSplit,
    feed,
    feedCounts,
    rollup,
    invested,
    history,
    funnel,
    disbursements,
  ] = await Promise.all([
    dashboardStats(),
    aiOverviewInsights(),
    pipelineOverview(),
    pipelineBreakdowns(),
    dealPipelineTrend(),
    onboardingStats(),
    pendingOnboardingInvestors(),
    intakeAwaitingReviewCount(),
    teamWorkload(),
    taskStatusByOwner(),
    overdueTasksCount(),
    overdueTasks(),
    pipelineActiveSplit(),
    stageChangeFeed(),
    stageChangeCounts(),
    investorEngagementRollup(),
    investedSummary(),
    historicalEngagementSummary(),
    partnerConversionFunnel(),
    disbursementByPeriod(),
  ]);

  return (
    <div className="space-y-6">
      <OnboardingQueueCard
        investors={pendingOnboarding.map((p) => ({
          id: p.id,
          name: p.name,
          registeredAt: p.registeredAt ? p.registeredAt.toISOString() : null,
          contactName: p.contactName,
          contactEmail: p.contactEmail,
        }))}
      />

      <IntakeQueueCallout count={intakeAwaitingReview} />

      {/* Page header */}
      <Reveal>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Where the pipeline stands today — deals, investors, tasks, and money in motion
          </p>
        </div>
      </Reveal>

      {/* Overview Agent */}
      <Reveal delay={0.05}>
        <OverviewAgentCard insights={insights} />
      </Reveal>

      {/* 4-up StatCard grid (staggered) — each card drills into the matching
          pre-filtered list (same pattern as the Pending Review card below). */}
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <a href={ACTIVE_MANDATES_HREF} className="block">
          <AnimatedStatCard
            label="Active Mandates"
            value={s.activeMandates.value}
            format="compact"
            delta={s.activeMandates.delta}
            sub="leads in pipeline"
            icon={<Target className="h-4 w-4" />}
          />
        </a>
        <a href={ACTIVE_TXNS_HREF} className="block">
          <AnimatedStatCard
            label="Active Transactions"
            value={s.activeTransactions.value}
            format="compact"
            delta={s.activeTransactions.delta}
            sub="fundraises in progress"
            icon={<Briefcase className="h-4 w-4" />}
          />
        </a>
        <a href="/investors" className="block">
          <AnimatedStatCard
            label="Investors Engaged"
            value={s.investorsEngagedQtr.value}
            format="compact"
            delta={s.investorsEngagedQtr.delta}
            deltaSuffix="active"
            deltaTitle="Investors with activity in the last 30 days"
            sub="this quarter"
            icon={<Users className="h-4 w-4" />}
          />
        </a>
        <a href="/deals?type=transaction&stage=ClosedWon" className="block">
          <AnimatedStatCard
            label="Capital Raised YTD"
            value={s.capitalRaisedYtd.value}
            format="money"
            delta={s.capitalRaisedYtd.delta}
            deltaFormat="money"
            deltaTitle="Capital raised in the last 30 days"
            sub="closed transactions"
            icon={<DollarSign className="h-4 w-4" />}
          />
        </a>
      </Stagger>

      {/* 2-up chart cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal delay={0.1}>
          <Card className="h-full">
            <CardHeader>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Deal Pipeline Trend</h2>
              <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Active deals vs closed over time</p>
            </CardHeader>
            <CardBody>
              <DealPipelineTrendChart data={trend} />
            </CardBody>
          </Card>
        </Reveal>

        <Reveal delay={0.15}>
          <Card className="h-full">
            <CardHeader>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Pipeline Overview</h2>
              <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Mandates &amp; transactions by stage</p>
            </CardHeader>
            <CardBody>
              <PipelineOverviewChart
                mandatesByStage={pipeline.mandatesByStage.map((sc) => ({ ...sc, href: `/deals?type=mandate&stage=${sc.stage}` }))}
                transactionsByStage={pipeline.transactionsByStage.map((sc) => ({ ...sc, href: `/deals?type=transaction&stage=${sc.stage}` }))}
                mandatesActive={pipeline.mandatesActive}
                transactionsActive={pipeline.transactionsActive}
              />
            </CardBody>
          </Card>
        </Reveal>
      </div>

      {/* Pipeline Breakdown — active transactions by lead / sector / financing type / ticket size */}
      <Reveal delay={0.18}>
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Pipeline Breakdown</h2>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
            Active transactions by deal lead, sector, financing type &amp; ticket size
          </p>
        </div>
      </Reveal>

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">By Deal Lead</h3>
          </CardHeader>
          <CardBody>
            {/* Lead filter matches by user NAME (the row label), not id. */}
            <BreakdownBarList rows={linkBreakdown(breakdowns.byLead, "lead", { byLabel: true })} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">By Sector</h3>
          </CardHeader>
          <CardBody>
            <BreakdownBarList rows={linkBreakdown(breakdowns.bySector.slice(0, 8), "sector")} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">By Financing Type</h3>
          </CardHeader>
          <CardBody>
            <BreakdownBarList rows={linkBreakdown(breakdowns.byFinancingType, "financing")} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">By Ticket Size</h3>
          </CardHeader>
          <CardBody>
            <BreakdownBarList rows={linkBreakdown(breakdowns.byTicketBand, "ticket")} />
          </CardBody>
        </Card>
      </Stagger>

      {/* Deal Status & Activity — active vs inactive split, invested summary, change feed */}
      <Reveal delay={0.19}>
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Deal Status &amp; Activity</h2>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Active vs inactive pipeline, invested deals &amp; recent changes</p>
        </div>
      </Reveal>

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Status params mirror ACTIVE_DEAL_STATUSES and its complement in
            dashboard.ts pipelineActiveSplit — mandates + transactions only
            (the split doesn't count advisory), hence the explicit type param. */}
        <a href="/deals?type=mandate,transaction&status=Open,ClosedReopened" className="block">
          <AnimatedStatCard
            label="Active Pipeline"
            value={activeSplit.mandates.active + activeSplit.transactions.active}
            format="compact"
            sub={`${activeSplit.mandates.active} mandates · ${activeSplit.transactions.active} transactions`}
          />
        </a>
        <a href="/deals?type=mandate,transaction&status=OnHold,Closed,ClosedOnHold,Dropped" className="block">
          <AnimatedStatCard
            label="Inactive / On Hold"
            value={activeSplit.mandates.inactive + activeSplit.transactions.inactive}
            format="compact"
            sub={`${activeSplit.mandates.inactive} mandates · ${activeSplit.transactions.inactive} transactions`}
          />
        </a>
        {/* Invested/Completed counts ENGAGEMENTS with disbursements — a /deals
            filter can't reproduce that definition, so this card stays unlinked. */}
        <AnimatedStatCard
          label="Invested / Completed"
          value={invested.count}
          format="compact"
          sub={`$${Math.round(invested.totalDisbursed).toLocaleString()} disbursed`}
        />
      </Stagger>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent Changes</h3>
            <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Stage, status &amp; identifier changes across all records</p>
          </CardHeader>
          <CardBody className="space-y-4">
            <StageChangeFeedList items={feed} />
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Transitions by field</p>
              <BreakdownBarList rows={feedCounts} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Investor Engagement</h3>
            <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Per-investor deals under review, rejected &amp; invested</p>
          </CardHeader>
          <CardBody>
            <InvestorRollupTable rows={rollup} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Historical Engagement</h3>
            <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Engagement outcomes by year &amp; quarter</p>
          </CardHeader>
          <CardBody>
            <HistoricalEngagementTable rows={history} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Referral Conversion</h3>
            <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Per-partner funnel: introduced → progressed → won / lost</p>
          </CardHeader>
          <CardBody>
            <PartnerFunnelTable rows={funnel} />
          </CardBody>
        </Card>
      </div>

      {/* Investor Onboarding stat group */}
      <Reveal delay={0.2}>
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Investor Onboarding</h2>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Registration review &amp; NDA coverage</p>
        </div>
      </Reveal>

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <a href="/investors?onboarding=PendingReview" className="block">
          <AnimatedStatCard
            label="Pending Review"
            value={onboarding.pendingReview}
            format="compact"
            sub="investor registrations awaiting review"
            icon={<ClipboardCheck className="h-4 w-4" />}
          />
        </a>
        <AnimatedStatCard
          label="Approved This Month"
          value={onboarding.approvedThisMonth}
          format="compact"
          sub="investors approved this month"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <AnimatedStatCard
          label="NDA Coverage"
          value={onboarding.ndaOpen + onboarding.ndaClosed + onboarding.ndaNone}
          format="compact"
          sub={`${onboarding.ndaOpen} open · ${onboarding.ndaClosed} closed · ${onboarding.ndaNone} none`}
          icon={<FileCheck2 className="h-4 w-4" />}
        />
      </Stagger>

      {/* Team & Tasks — deal load, task ownership, overdue actions */}
      <Reveal delay={0.25}>
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Team &amp; Tasks</h2>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Deal load, task ownership &amp; overdue action points</p>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Deal Load by Team Member</h3>
            <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Open mandates + active transactions</p>
          </CardHeader>
          <CardBody>
            <TeamWorkloadTable rows={workload} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Task Status by Owner</h3>
            <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Assigned tasks, by status</p>
          </CardHeader>
          <CardBody>
            <TaskStatusCrosstab rows={statusByOwner} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Overdue Actions
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Escalated past their deadline</p>
          </CardHeader>
          <CardBody>
            <OverdueActionsList count={overdueCount} items={overdueList} />
          </CardBody>
        </Card>
      </div>
      {/* Disbursements by quarter (§13) */}
      <Reveal delay={0.2}>
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Disbursements by Quarter</h2>
            <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Investor funds disbursed vs pending, per calendar quarter</p>
          </CardHeader>
          <CardBody>
            {disbursements.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No disbursements recorded.</p>
            ) : (
              <DisbursementPeriodChart data={disbursements} />
            )}
          </CardBody>
        </Card>
      </Reveal>
    </div>
  );
}
