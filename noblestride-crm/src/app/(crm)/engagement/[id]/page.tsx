// engagement/[id]/page.tsx — Engagement detail page.
// Server Component: single engagement with investor, transaction, and activity timeline.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getEngagement } from "@/server/services/engagements";
import { Chip, Card, CardHeader, CardBody, Avatar } from "@/components/ui";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import type { ActivityTimelineItem } from "@/components/crm/activity-timeline";
import { StageHistory } from "@/components/crm/stage-history";
import type { StageHistoryItem } from "@/components/crm/stage-history";
import { formatDate, daysAgoLabel } from "@/lib/format";
import { RecordClosedNdaButton } from "@/components/crm/nda-actions";
import { EngagementFormDrawer } from "@/components/crm/engagement-form-drawer";

// Next 16: params is a Promise
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EngagementDetailPage({ params }: PageProps) {
  const { id } = await params;
  const engagement = await getEngagement(id);

  if (!engagement) notFound();

  const activityItems: ActivityTimelineItem[] = engagement.activities.map((a) => ({
    id: a.id,
    type: a.type,
    subject: a.subject,
    occurredAt: a.occurredAt,
  }));

  const stageHistoryItems: StageHistoryItem[] = engagement.stageChanges.map((s) => ({
    id: s.id,
    field: s.field,
    fromValue: s.fromValue,
    toValue: s.toValue,
    changedAt: s.changedAt,
    changedByName: s.changedBy?.name,
    createdSource: s.createdSource,
  }));

  const toDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
  const editInitial = {
    id: engagement.id,
    transactionId: engagement.transactionId,
    investorId: engagement.investorId,
    interestLevel: engagement.interestLevel ?? "",
    ndaType: engagement.ndaType ?? "",
    termSheetIssued: engagement.termSheetIssued,
    termSheetDate: toDate(engagement.termSheetDate),
    totalAmount: engagement.totalAmount == null ? undefined : Number(engagement.totalAmount),
    amountDisbursed: engagement.amountDisbursed == null ? undefined : Number(engagement.amountDisbursed),
    disbursementStatus: engagement.disbursementStatus ?? "",
    dateReceived: toDate(engagement.dateReceived),
    probability: engagement.probability == null ? undefined : Number(engagement.probability),
    feedback: engagement.feedback ?? "",
    notes: engagement.notes ?? "",
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/engagement" className="hover:text-zinc-700 transition-colors">
          Engagement
        </Link>
        <span>/</span>
        <span className="text-zinc-900 font-medium">{engagement.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar name={engagement.investor.name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900 leading-tight">{engagement.name}</h1>
            <Chip value={engagement.status} group="EngagementStatus" />
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {engagement.investor.name} · {engagement.transaction.name}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <EngagementFormDrawer initial={editInitial} />
        </div>
      </div>

      {/* Key facts */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">Details</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Status</dt>
              <dd className="mt-1">
                <Chip value={engagement.status} group="EngagementStatus" />
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Investor</dt>
              <dd className="mt-1 text-sm font-medium text-zinc-900">
                <Link href={`/investors/${engagement.investor.id}`} className="hover:text-accent transition-colors">
                  {engagement.investor.name}
                </Link>
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Transaction</dt>
              <dd className="mt-1 text-sm font-medium text-zinc-900">
                <Link href={`/transactions/${engagement.transaction.id}`} className="hover:text-accent transition-colors">
                  {engagement.transaction.name}
                </Link>
              </dd>
            </div>

            {engagement.lastContact && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Last Contact</dt>
                <dd className="mt-1 text-sm text-zinc-900">
                  {formatDate(engagement.lastContact)}{" "}
                  <span className="text-zinc-400">({daysAgoLabel(engagement.lastContact)})</span>
                </dd>
              </div>
            )}

            {engagement.owner && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Owner</dt>
                <dd className="mt-1 text-sm font-medium text-zinc-900">{engagement.owner.name}</dd>
              </div>
            )}

            {engagement.notes && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Notes</dt>
                <dd className="mt-1 text-sm text-zinc-700 whitespace-pre-line">{engagement.notes}</dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      {/* NDA */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">NDA</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Engagement NDA</dt>
              <dd className="mt-1">
                {engagement.ndaType ? (
                  <div className="flex items-center gap-2">
                    <Chip value={engagement.ndaType} group="NdaType" />
                    {engagement.ndaSignedAt && (
                      <span className="text-xs text-zinc-500">{formatDate(engagement.ndaSignedAt)}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-zinc-400">No NDA recorded</span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Investor NDA Status</dt>
              <dd className="mt-1">
                <Chip value={engagement.investor.ndaStatus} group="InvestorNdaStatus" />
              </dd>
            </div>
          </dl>

          {engagement.ndaType == null && <RecordClosedNdaButton engagementId={engagement.id} />}

          <p className="text-xs text-zinc-400">
            Stage changes past Teaser require an NDA (Open on the investor, or Closed here).
          </p>
        </CardBody>
      </Card>

      <StageHistory stageGroup="EngagementStage" items={stageHistoryItems} />

      {/* Activity timeline */}
      <ActivityTimeline activities={activityItems} />
    </div>
  );
}
