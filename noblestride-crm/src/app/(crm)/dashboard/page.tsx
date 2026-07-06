// dashboard/page.tsx — RSC Dashboard page.
// Calls services directly (NOT urql). No "use client".

import { Target, Briefcase, Users, DollarSign, ClipboardCheck, CheckCircle2, FileCheck2, AlertTriangle } from "lucide-react";
import {
  dashboardStats,
  pipelineOverview,
  pipelineBreakdowns,
  dealPipelineTrend,
  onboardingStats,
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
} from "@/server/services/dashboard";
import { aiOverviewInsights } from "@/server/services/ai";
import { Card, CardHeader, CardBody } from "@/components/ui";
import { AnimatedStatCard } from "@/components/ui/animated-stat-card";
import { Reveal, Stagger } from "@/components/ui/motion";
import { OverviewAgentCard } from "@/components/crm/overview-agent-card";
import { DealPipelineTrendChart, PipelineOverviewChart } from "@/components/crm/pipeline-chart";
import { BreakdownBarList } from "@/components/crm/pipeline-breakdown";
import { TeamWorkloadTable, TaskStatusCrosstab, OverdueActionsList } from "@/components/crm/team-tasks-panel";
import {
  StageChangeFeedList,
  InvestorRollupTable,
  HistoricalEngagementTable,
  PartnerFunnelTable,
} from "@/components/crm/deal-analytics-panels";

export default async function DashboardPage() {
  const [
    s,
    insights,
    pipeline,
    breakdowns,
    trend,
    onboarding,
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
  ] = await Promise.all([
    dashboardStats(),
    aiOverviewInsights(),
    pipelineOverview(),
    pipelineBreakdowns(),
    dealPipelineTrend(),
    onboardingStats(),
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
  ]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <Reveal>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Overview of your deal pipeline and investor activity
          </p>
        </div>
      </Reveal>

      {/* Overview Agent */}
      <Reveal delay={0.05}>
        <OverviewAgentCard insights={insights} />
      </Reveal>

      {/* 4-up StatCard grid (staggered) */}
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AnimatedStatCard
          label="Active Mandates"
          value={s.activeMandates.value}
          format="compact"
          delta={s.activeMandates.delta}
          sub="leads in pipeline"
          icon={<Target className="h-4 w-4" />}
        />
        <AnimatedStatCard
          label="Active Transactions"
          value={s.activeTransactions.value}
          format="compact"
          delta={s.activeTransactions.delta}
          sub="fundraises in progress"
          icon={<Briefcase className="h-4 w-4" />}
        />
        <AnimatedStatCard
          label="Investors Engaged"
          value={s.investorsEngagedQtr.value}
          format="compact"
          delta={s.investorsEngagedQtr.delta}
          sub="this quarter"
          icon={<Users className="h-4 w-4" />}
        />
        <AnimatedStatCard
          label="Capital Raised YTD"
          value={s.capitalRaisedYtd.value}
          format="money"
          delta={s.capitalRaisedYtd.delta}
          deltaFormat="money"
          sub="closed transactions"
          icon={<DollarSign className="h-4 w-4" />}
        />
      </Stagger>

      {/* 2-up chart cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal delay={0.1}>
          <Card className="h-full transition-shadow duration-300 hover:shadow-md">
            <CardHeader>
              <h2 className="text-sm font-semibold text-zinc-900">Deal Pipeline Trend</h2>
              <p className="mt-0.5 text-xs text-zinc-500">Active deals vs closed over time</p>
            </CardHeader>
            <CardBody>
              <DealPipelineTrendChart data={trend} />
            </CardBody>
          </Card>
        </Reveal>

        <Reveal delay={0.15}>
          <Card className="h-full transition-shadow duration-300 hover:shadow-md">
            <CardHeader>
              <h2 className="text-sm font-semibold text-zinc-900">Pipeline Overview</h2>
              <p className="mt-0.5 text-xs text-zinc-500">Mandates &amp; transactions by stage</p>
            </CardHeader>
            <CardBody>
              <PipelineOverviewChart
                mandatesByStage={pipeline.mandatesByStage}
                transactionsByStage={pipeline.transactionsByStage}
              />
            </CardBody>
          </Card>
        </Reveal>
      </div>

      {/* Pipeline Breakdown — active transactions by lead / sector / financing type / ticket size */}
      <Reveal delay={0.18}>
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Pipeline Breakdown</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Active transactions by deal lead, sector, financing type &amp; ticket size
          </p>
        </div>
      </Reveal>

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">By Deal Lead</h3>
          </CardHeader>
          <CardBody>
            <BreakdownBarList rows={breakdowns.byLead} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">By Sector</h3>
          </CardHeader>
          <CardBody>
            <BreakdownBarList rows={breakdowns.bySector.slice(0, 8)} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">By Financing Type</h3>
          </CardHeader>
          <CardBody>
            <BreakdownBarList rows={breakdowns.byFinancingType} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">By Ticket Size</h3>
          </CardHeader>
          <CardBody>
            <BreakdownBarList rows={breakdowns.byTicketBand} />
          </CardBody>
        </Card>
      </Stagger>

      {/* Deal Status & Activity — active vs inactive split, invested summary, change feed */}
      <Reveal delay={0.19}>
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Deal Status &amp; Activity</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Active vs inactive pipeline, invested deals &amp; recent changes</p>
        </div>
      </Reveal>

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AnimatedStatCard
          label="Active Pipeline"
          value={activeSplit.mandates.active + activeSplit.transactions.active}
          format="compact"
          sub={`${activeSplit.mandates.active} mandates · ${activeSplit.transactions.active} transactions`}
        />
        <AnimatedStatCard
          label="Inactive / On Hold"
          value={activeSplit.mandates.inactive + activeSplit.transactions.inactive}
          format="compact"
          sub={`${activeSplit.mandates.inactive} mandates · ${activeSplit.transactions.inactive} transactions`}
        />
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
            <h3 className="text-sm font-semibold text-zinc-900">Recent Changes</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Stage, status &amp; identifier changes across all records</p>
          </CardHeader>
          <CardBody className="space-y-4">
            <StageChangeFeedList items={feed} />
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Transitions by field</p>
              <BreakdownBarList rows={feedCounts} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-zinc-900">Investor Engagement</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Per-investor deals under review, rejected &amp; invested</p>
          </CardHeader>
          <CardBody>
            <InvestorRollupTable rows={rollup} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-zinc-900">Historical Engagement</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Engagement outcomes by year &amp; quarter</p>
          </CardHeader>
          <CardBody>
            <HistoricalEngagementTable rows={history} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-zinc-900">Referral Conversion</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Per-partner funnel: introduced → progressed → won / lost</p>
          </CardHeader>
          <CardBody>
            <PartnerFunnelTable rows={funnel} />
          </CardBody>
        </Card>
      </div>

      {/* Investor Onboarding stat group */}
      <Reveal delay={0.2}>
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Investor Onboarding</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Registration review &amp; NDA coverage</p>
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
          <h2 className="text-sm font-semibold text-zinc-900">Team &amp; Tasks</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Deal load, task ownership &amp; overdue action points</p>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-zinc-900">Deal Load by Team Member</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Open mandates + active transactions</p>
          </CardHeader>
          <CardBody>
            <TeamWorkloadTable rows={workload} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-zinc-900">Task Status by Owner</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Assigned tasks, by status</p>
          </CardHeader>
          <CardBody>
            <TaskStatusCrosstab rows={statusByOwner} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Overdue Actions
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">Escalated past their deadline</p>
          </CardHeader>
          <CardBody>
            <OverdueActionsList count={overdueCount} items={overdueList} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
