// dashboard/page.tsx — RSC Dashboard page.
// Calls services directly (NOT urql). No "use client".

import { Target, Briefcase, Users, DollarSign, ClipboardCheck, CheckCircle2, FileCheck2 } from "lucide-react";
import {
  dashboardStats,
  pipelineOverview,
  dealPipelineTrend,
  onboardingStats,
} from "@/server/services/dashboard";
import { aiOverviewInsights } from "@/server/services/ai";
import { Card, CardHeader, CardBody } from "@/components/ui";
import { AnimatedStatCard } from "@/components/ui/animated-stat-card";
import { Reveal, Stagger } from "@/components/ui/motion";
import { OverviewAgentCard } from "@/components/crm/overview-agent-card";
import { DealPipelineTrendChart, PipelineOverviewChart } from "@/components/crm/pipeline-chart";

export default async function DashboardPage() {
  const [s, insights, pipeline, trend, onboarding] = await Promise.all([
    dashboardStats(),
    aiOverviewInsights(),
    pipelineOverview(),
    dealPipelineTrend(),
    onboardingStats(),
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
    </div>
  );
}
