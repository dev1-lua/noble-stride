// engagement/deals/page.tsx — Engagement tracker, By Deal (deal-focal) view.
// Server Component: counters + By-Deal focal pipeline board + disbursements
// + activity timeline. Client islands: LogEngagementDialog + FocalPipelineBoard.

import { engagementsByDeal, engagementsByStage, listDisbursements, stageCountsFor } from "@/server/services/engagements";
import { engagementCounters, activityTimeline } from "@/server/services/activities";
import { listTransactions } from "@/server/services/transactions";
import { listInvestors } from "@/server/services/investors";
import { disbursementByPeriod } from "@/server/services/dashboard";
import { relationOptions } from "@/server/services/relation-options";
import { StatCard } from "@/components/ui";
import { label } from "@/lib/vocab";
import { ENGAGEMENT_STAGES, stageColorSwatch, engagementStageOptions } from "@/lib/engagement-stage-colors";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import type { ActivityTimelineItem } from "@/components/crm/activity-timeline";
import { LogEngagementDialog } from "@/components/crm/log-engagement-dialog";
import { FocalPipelineBoard } from "@/components/crm/focal-pipeline-board";
import type { FocalGroupDTO } from "@/components/crm/focal-pipeline-board";
import { DisbursementTable } from "@/components/crm/disbursement-table";
import type { DisbursementRow } from "@/components/crm/disbursement-table";
import { DisbursementPeriodSummary } from "@/components/crm/disbursement-period-summary";
import { getOrgLens } from "@/server/rbac/context";
import { can, canUpdateRecord } from "@/server/rbac/matrix";

export default async function EngagementByDealPage() {
  const lens = await getOrgLens();
  // Parallel fetches
  const [counters, byDeal, stageColumns, disbursements, periodSummary, timeline, transactions, investors, rel] =
    await Promise.all([
      engagementCounters(),
      engagementsByDeal(),
      engagementsByStage(),
      listDisbursements(),
      disbursementByPeriod(),
      activityTimeline(),
      listTransactions(),
      listInvestors({}),
      relationOptions(),
    ]);

  const stageOptions = engagementStageOptions();

  // "Deals rejected" — engagements that reached the Declined stage. Reuses the
  // stage buckets already loaded above (engagementsByStage), so this costs no
  // additional query.
  const declinedCount = stageColumns.find((c) => c.stage === "Declined")?.items.length ?? 0;

  // Build SelectOption[] for dialog (plain strings — safe to pass to client component)
  const txnOptions = transactions.map((t) => ({ value: t.id, label: t.name }));
  const invOptions = investors.map((i) => ({ value: i.id, label: i.name }));

  // Shape by-deal groups into the shared FocalPipelineBoard DTO shape.
  const dealGroups: FocalGroupDTO[] = byDeal.map(({ transaction, engagements }) => ({
    id: transaction.id,
    name: transaction.name,
    href: `/transactions/${transaction.id}`,
    countLabel: `${engagements.length} investor${engagements.length === 1 ? "" : "s"}`,
    stageCounts: stageCountsFor(engagements),
    items: engagements.map((e) => ({
      id: e.id,
      transactionId: e.transactionId,
      investorId: e.investorId,
      counterpartName: e.investor.name,
      counterpartHref: `/investors/${e.investorId}`,
      stage: e.engagementStage,
      interestLevel: e.interestLevel,
      canRestage: canUpdateRecord(lens.orgRole, "Engagements", lens.userId, { ownerId: e.ownerId }),
    })),
  }));

  // Disbursement rows (Decimal → number)
  const toDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
  const disbursementRows: DisbursementRow[] = disbursements.map((eng) => ({
    id: eng.id,
    investorId: eng.investorId,
    investorName: eng.investor.name,
    transactionId: eng.transactionId,
    transactionName: eng.transaction.name,
    totalAmount: eng.totalAmount == null ? null : Number(eng.totalAmount),
    amountDisbursed: eng.amountDisbursed == null ? null : Number(eng.amountDisbursed),
    amountPending: eng.amountPending == null ? null : Number(eng.amountPending),
    disbursementStatus: eng.disbursementStatus,
    dateReceived: eng.dateReceived,
    editInitial: {
      id: eng.id,
      transactionId: eng.transactionId,
      investorId: eng.investorId,
      interestLevel: eng.interestLevel ?? "",
      ndaType: eng.ndaType ?? "",
      termSheetIssued: eng.termSheetIssued,
      termSheetDate: toDate(eng.termSheetDate),
      totalAmount: eng.totalAmount == null ? undefined : Number(eng.totalAmount),
      amountDisbursed: eng.amountDisbursed == null ? undefined : Number(eng.amountDisbursed),
      disbursementStatus: eng.disbursementStatus ?? "",
      dateReceived: toDate(eng.dateReceived),
      probability: eng.probability == null ? undefined : Number(eng.probability),
      feedback: eng.feedback ?? "",
      notes: eng.notes ?? "",
    },
  }));

  // Map timeline activities to ActivityTimelineItem
  const timelineItems: ActivityTimelineItem[] = timeline.map((a) => ({
    id: a.id,
    type: a.type,
    subject: a.subject,
    body: a.body,
    occurredAt: a.occurredAt,
    context: [a.investor?.name, a.transaction?.name].filter(Boolean).join(" · ") || null,
    channel: a.channel,
    direction: a.direction,
    links: { clientId: a.clientId, mandateId: a.mandateId, transactionId: a.transactionId, investorId: a.investorId },
    tasks: (a.tasks ?? []).map((t) => ({ id: t.id, title: t.title, status: t.status })),
  }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Engagement — By Deal</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Each deal and the investors engaged on it, by pipeline stage
          </p>
        </div>
        {can(lens.orgRole, "Engagements", "C") && (
          <LogEngagementDialog transactions={txnOptions} investors={invOptions} />
        )}
      </div>

      {/* Counters strip — 6 activity-driven tiles + deals rejected (stage-driven) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
        <StatCard label="Outreach" value={String(counters.outreach)} />
        <StatCard label="NDA Signed" value={String(counters.ndaSigned)} />
        <StatCard label="Data Room" value={String(counters.dataRoom)} />
        <StatCard label="Meetings" value={String(counters.meetings)} />
        <StatCard label="Feedback" value={String(counters.feedback)} />
        <StatCard label="Term Sheets" value={String(counters.termSheets)} />
        <StatCard label="Deals Rejected" value={String(declinedCount)} />
      </div>

      {/* Stage legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
        {ENGAGEMENT_STAGES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${stageColorSwatch(s)}`} />
            {label("EngagementStage", s)}
          </span>
        ))}
      </div>

      {/* By-Deal focal pipeline board */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide mb-3">
          Pipeline — By Deal
        </h2>
        <FocalPipelineBoard groups={dealGroups} stageOptions={stageOptions} />
      </div>

      {/* Disbursements + activity timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: invested engagements with disbursement tracking */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">
            Disbursements
          </h2>
          <DisbursementTable rows={disbursementRows} />

          <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide pt-2">
            By Year &amp; Quarter
          </h3>
          <DisbursementPeriodSummary rows={periodSummary} />
        </div>

        {/* RIGHT: activity timeline */}
        <div className="lg:col-span-2">
          <ActivityTimeline
            activities={timelineItems}
            title="Activity Timeline"
            emptyText="No activity recorded yet."
            taskOptions={{ mandates: rel.mandates, transactions: rel.transactions, investors: rel.investors, clients: rel.clients, users: rel.users }}
          />
        </div>
      </div>
    </div>
  );
}
