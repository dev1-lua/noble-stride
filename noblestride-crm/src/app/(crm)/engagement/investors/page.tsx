// engagement/investors/page.tsx — Engagement tracker, By Investor
// (investor-focal) view. Lighter than the By-Deal page: header + counters +
// legend + the shared FocalPipelineBoard only (no disbursements/timeline).

import { engagementCounters } from "@/server/services/activities";
import { engagementsByInvestor, stageCountsFor } from "@/server/services/engagements";
import { listTransactions } from "@/server/services/transactions";
import { listInvestors } from "@/server/services/investors";
import { FocalPipelineBoard } from "@/components/crm/focal-pipeline-board";
import type { FocalGroupDTO } from "@/components/crm/focal-pipeline-board";
import { StatCard, HelpHint, Badge } from "@/components/ui";
import { LogEngagementDialog } from "@/components/crm/log-engagement-dialog";
import { ENGAGEMENT_STAGES, stageColorSwatch, engagementStageOptions } from "@/lib/engagement-stage-colors";
import { label } from "@/lib/vocab";
import { getOrgLens } from "@/server/rbac/context";
import { can, canUpdateRecord } from "@/server/rbac/matrix";

export default async function EngagementByInvestorPage() {
  const lens = await getOrgLens();
  const [counters, byInvestor, transactions, investors] = await Promise.all([
    engagementCounters(),
    engagementsByInvestor(),
    listTransactions(),
    listInvestors({}),
  ]);

  const stageOptions = engagementStageOptions();

  const groups: FocalGroupDTO[] = byInvestor.map(({ investor, engagements }) => ({
    id: investor.id,
    name: investor.name,
    href: `/investors/${investor.id}`,
    countLabel: `${engagements.length} deal${engagements.length === 1 ? "" : "s"}`,
    stageCounts: stageCountsFor(engagements),
    items: engagements.map((e) => ({
      id: e.id,
      transactionId: e.transactionId,
      investorId: e.investorId,
      counterpartName: e.transaction.name,
      counterpartHref: `/transactions/${e.transactionId}`,
      stage: e.engagementStage,
      interestLevel: e.interestLevel,
      canRestage: canUpdateRecord(lens.orgRole, "Engagements", lens.userId, { ownerId: e.ownerId }),
    })),
  }));

  const txnOptions = transactions.map((t) => ({ value: t.id, label: t.name }));
  const invOptions = investors.map((i) => ({ value: i.id, label: i.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900">
            Engagement — By Investor
            <HelpHint term="Investor Engagement" />
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Each investor and the deals they&apos;re engaged on, by pipeline stage</p>
          <Badge tone="warning" title="Illustrative sample data — the investor engagement pipeline is not sourced from the client trackers. Real engagements appear here as the team logs them.">
            Demo data
          </Badge>
        </div>
        {can(lens.orgRole, "Engagements", "C") && (
          <LogEngagementDialog transactions={txnOptions} investors={invOptions} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Outreach" value={String(counters.outreach)} />
        <StatCard label="NDA Signed" value={String(counters.ndaSigned)} />
        <StatCard label="Data Room" value={String(counters.dataRoom)} />
        <StatCard label="Meetings" value={String(counters.meetings)} />
        <StatCard label="Feedback" value={String(counters.feedback)} />
        <StatCard label="Term Sheets" value={String(counters.termSheets)} />
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
        {ENGAGEMENT_STAGES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${stageColorSwatch(s)}`} />
            {label("EngagementStage", s)}
          </span>
        ))}
      </div>

      <FocalPipelineBoard groups={groups} stageOptions={stageOptions} />
    </div>
  );
}
