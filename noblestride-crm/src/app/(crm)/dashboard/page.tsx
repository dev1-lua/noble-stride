// dashboard/page.tsx — RSC Dashboard page.
// Calls services directly (NOT urql). No "use client".

import { Target, Briefcase, Users, DollarSign } from "lucide-react";
import { dashboardStats, pipelineOverview, dealPipelineTrend, disbursementByPeriod } from "@/server/services/dashboard";
import { aiOverviewInsights } from "@/server/services/ai";
import { Card, CardHeader, CardBody } from "@/components/ui";
import { AnimatedStatCard } from "@/components/ui/animated-stat-card";
import { Reveal, Stagger } from "@/components/ui/motion";
import { OverviewAgentCard } from "@/components/crm/overview-agent-card";
import { DealPipelineTrendChart, PipelineOverviewChart } from "@/components/crm/pipeline-chart";
import { DisbursementPeriodChart } from "@/components/crm/disbursement-period-chart";

export default async function DashboardPage() {
  const [s, insights, pipeline, trend, disbursements] = await Promise.all([
    dashboardStats(),
    aiOverviewInsights(),
    pipelineOverview(),
    dealPipelineTrend(),
    disbursementByPeriod(),
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

      {/* Disbursements by quarter (§13) */}
      <Reveal delay={0.2}>
        <Card className="transition-shadow duration-300 hover:shadow-md">
          <CardHeader>
            <h2 className="text-sm font-semibold text-zinc-900">Disbursements by Quarter</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Investor funds disbursed vs pending, per calendar quarter</p>
          </CardHeader>
          <CardBody>
            {disbursements.length === 0 ? (
              <p className="text-sm text-zinc-400">No disbursements recorded.</p>
            ) : (
              <DisbursementPeriodChart data={disbursements} />
            )}
          </CardBody>
        </Card>
      </Reveal>
    </div>
  );
}
