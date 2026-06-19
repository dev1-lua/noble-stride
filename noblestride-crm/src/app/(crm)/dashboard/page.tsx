// dashboard/page.tsx — RSC Dashboard page.
// Calls services directly (NOT urql). No "use client".

import { Target, Briefcase, Users, DollarSign } from "lucide-react";
import { dashboardStats, pipelineOverview, dealPipelineTrend } from "@/server/services/dashboard";
import { aiOverviewInsights } from "@/server/services/ai";
import { StatCard, Card, CardHeader, CardBody } from "@/components/ui";
import { OverviewAgentCard } from "@/components/crm/overview-agent-card";
import { DealPipelineTrendChart, PipelineOverviewChart } from "@/components/crm/pipeline-chart";
import { formatCompact } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export default async function DashboardPage() {
  const [s, insights, pipeline, trend] = await Promise.all([
    dashboardStats(),
    aiOverviewInsights(),
    pipelineOverview(),
    dealPipelineTrend(),
  ]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Overview of your deal pipeline and investor activity</p>
      </div>

      {/* Overview Agent */}
      <OverviewAgentCard insights={insights} />

      {/* 4-up StatCard grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Active Mandates"
          value={formatCompact(s.activeMandates.value)}
          delta={s.activeMandates.delta > 0 ? "+" + s.activeMandates.delta : undefined}
          sub="leads in pipeline"
          icon={<Target className="h-4 w-4" />}
        />
        <StatCard
          label="Active Transactions"
          value={formatCompact(s.activeTransactions.value)}
          delta={s.activeTransactions.delta > 0 ? "+" + s.activeTransactions.delta : undefined}
          sub="fundraises in progress"
          icon={<Briefcase className="h-4 w-4" />}
        />
        <StatCard
          label="Investors Engaged"
          value={formatCompact(s.investorsEngagedQtr.value)}
          delta={s.investorsEngagedQtr.delta > 0 ? "+" + s.investorsEngagedQtr.delta : undefined}
          sub="this quarter"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Capital Raised YTD"
          value={formatMoney(s.capitalRaisedYtd.value)}
          delta={
            s.capitalRaisedYtd.delta > 0
              ? "+" + formatMoney(s.capitalRaisedYtd.delta)
              : undefined
          }
          sub="closed transactions"
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* 2-up chart cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deal Pipeline Trend */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-zinc-900">Deal Pipeline Trend</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Active deals vs closed over time</p>
          </CardHeader>
          <CardBody>
            <DealPipelineTrendChart data={trend} />
          </CardBody>
        </Card>

        {/* Pipeline Overview */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-zinc-900">Pipeline Overview</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Mandates &amp; transactions by stage</p>
          </CardHeader>
          <CardBody>
            <PipelineOverviewChart
              mandatesByStage={pipeline.mandatesByStage}
              transactionsByStage={pipeline.transactionsByStage}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
