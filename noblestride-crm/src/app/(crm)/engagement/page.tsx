// engagement/page.tsx — Engagement tracker.
// Server Component: counters + 12-stage engagement pipeline board + disbursements
// + activity timeline. Client islands: LogEngagementDialog + per-card restage select.

import { engagementsByStage, listDisbursements } from "@/server/services/engagements";
import { engagementCounters, activityTimeline } from "@/server/services/activities";
import { listTransactions } from "@/server/services/transactions";
import { listInvestors } from "@/server/services/investors";
import { disbursementByPeriod } from "@/server/services/dashboard";
import { StatCard } from "@/components/ui";
import { options } from "@/lib/vocab";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import type { ActivityTimelineItem } from "@/components/crm/activity-timeline";
import { LogEngagementDialog } from "@/components/crm/log-engagement-dialog";
import { EngagementStageBoard } from "@/components/crm/engagement-stage-board";
import type { EngagementStageColumnDTO } from "@/components/crm/engagement-stage-board";
import { DisbursementTable } from "@/components/crm/disbursement-table";
import type { DisbursementRow } from "@/components/crm/disbursement-table";
import { DisbursementPeriodSummary } from "@/components/crm/disbursement-period-summary";

export default async function EngagementPage() {
  // Parallel fetches
  const [counters, stageColumns, disbursements, periodSummary, timeline, transactions, investors] =
    await Promise.all([
      engagementCounters(),
      engagementsByStage(),
      listDisbursements(),
      disbursementByPeriod(),
      activityTimeline(),
      listTransactions(),
      listInvestors({}),
    ]);

  // "Deals rejected" — engagements that reached the Declined stage. Reuses the
  // stage buckets already loaded above (engagementsByStage), so this costs no
  // additional query.
  const declinedCount = stageColumns.find((c) => c.stage === "Declined")?.items.length ?? 0;

  // Build SelectOption[] for dialog (plain strings — safe to pass to client component)
  const txnOptions = transactions.map((t) => ({ value: t.id, label: t.name }));
  const invOptions = investors.map((i) => ({ value: i.id, label: i.name }));
  const stageOptions = options("EngagementStage");

  // Shape pipeline columns into plain DTOs (no Prisma types cross the boundary)
  const columns: EngagementStageColumnDTO[] = stageColumns.map((col) => ({
    stage: col.stage,
    label: col.label,
    items: col.items.map((eng) => ({
      id: eng.id,
      transactionId: eng.transactionId,
      investorId: eng.investorId,
      investorName: eng.investor.name,
      transactionName: eng.transaction.name,
      interestLevel: eng.interestLevel,
      ndaType: eng.ndaType,
      termSheetIssued: eng.termSheetIssued,
      probability: eng.probability,
    })),
  }));

  // Disbursement rows (Decimal → number)
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
  }));

  // Map timeline activities to ActivityTimelineItem
  const timelineItems: ActivityTimelineItem[] = timeline.map((a) => ({
    id: a.id,
    type: a.type,
    subject: a.subject,
    occurredAt: a.occurredAt,
    context: [a.investor?.name, a.transaction?.name].filter(Boolean).join(" · ") || null,
    channel: a.channel,
    direction: a.direction,
  }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Engagement Tracker</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Investor interactions across all active deals
          </p>
        </div>
        <LogEngagementDialog transactions={txnOptions} investors={invOptions} />
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

      {/* 12-stage engagement pipeline board */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide mb-3">
          Pipeline
        </h2>
        <EngagementStageBoard columns={columns} stageOptions={stageOptions} />
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
          />
        </div>
      </div>
    </div>
  );
}
