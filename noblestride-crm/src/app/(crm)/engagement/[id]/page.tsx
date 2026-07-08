// engagement/[id]/page.tsx — Engagement detail page.
// Server Component: single engagement with investor, transaction, and activity timeline.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getEngagement } from "@/server/services/engagements";
import { relationOptions } from "@/server/services/relation-options";
import { Chip, Card, CardHeader, CardBody, Avatar } from "@/components/ui";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import type { ActivityTimelineItem } from "@/components/crm/activity-timeline";
import { StageHistory } from "@/components/crm/stage-history";
import type { StageHistoryItem } from "@/components/crm/stage-history";
import { formatDate, daysAgoLabel } from "@/lib/format";
import { RecordClosedNdaButton } from "@/components/crm/nda-actions";
import { EngagementFormDrawer } from "@/components/crm/engagement-form-drawer";
import { MilestoneChecklist } from "@/components/crm/milestone-checklist";
import type { MilestoneItemDTO } from "@/components/crm/milestone-checklist";
import { MILESTONE_ORDER, MILESTONE_LABELS, effectiveMilestones } from "@/lib/milestones";
import { getOrgLens } from "@/server/rbac/context";
import { canUpdateRecord } from "@/server/rbac/matrix";
import { EngagementRestageSelect } from "@/components/crm/engagement-restage-select";
import { engagementStageOptions } from "@/lib/engagement-stage-colors";

// Next 16: params is a Promise
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EngagementDetailPage({ params }: PageProps) {
  const { id } = await params;
  const engagement = await getEngagement(id);

  if (!engagement) notFound();

  const rel = await relationOptions();

  const lens = await getOrgLens();
  const canRestage = canUpdateRecord(lens.orgRole, "Engagements", lens.userId, { ownerId: engagement.ownerId });
  const stageOptions = engagementStageOptions();

  const activityItems: ActivityTimelineItem[] = engagement.activities.map((a) => ({
    id: a.id,
    type: a.type,
    subject: a.subject,
    body: a.body,
    occurredAt: a.occurredAt,
    links: { transactionId: engagement.transactionId, investorId: engagement.investorId },
    tasks: (a.tasks ?? []).map((t) => ({ id: t.id, title: t.title, status: t.status })),
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

  const recordedByKey = new Map(engagement.milestones.map((m) => [m.key, m]));
  const implied = effectiveMilestones(engagement.engagementStage, []);
  const milestoneItems: MilestoneItemDTO[] = MILESTONE_ORDER.map((key) => {
    const rec = recordedByKey.get(key);
    return {
      key,
      label: MILESTONE_LABELS[key],
      state: rec ? ("recorded" as const) : implied.has(key) ? ("implied" as const) : ("open" as const),
      completedAt: rec ? rec.completedAt.toISOString().slice(0, 10) : null,
    };
  });

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
      <nav className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Link href="/engagement" className="hover:text-[var(--text-secondary)] transition-colors">
          Engagement
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">{engagement.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar name={engagement.investor.name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">{engagement.name}</h1>
            <Chip value={engagement.status} group="EngagementStatus" />
          </div>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            {engagement.investor.name} · {engagement.transaction.name}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {canRestage && <EngagementFormDrawer initial={editInitial} />}
        </div>
      </div>

      {/* Key facts */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Details</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Stage</dt>
              <dd className="mt-1">
                {canRestage ? (
                  <div className="max-w-56">
                    <EngagementRestageSelect
                      id={engagement.id}
                      transactionId={engagement.transactionId}
                      investorId={engagement.investorId}
                      currentStage={engagement.engagementStage}
                      stageOptions={stageOptions}
                    />
                  </div>
                ) : (
                  <Chip value={engagement.engagementStage} group="EngagementStage" />
                )}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Status</dt>
              <dd className="mt-1">
                <Chip value={engagement.status} group="EngagementStatus" />
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Investor</dt>
              <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                <Link href={`/investors/${engagement.investor.id}`} className="hover:text-accent transition-colors">
                  {engagement.investor.name}
                </Link>
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Transaction</dt>
              <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                <Link href={`/transactions/${engagement.transaction.id}`} className="hover:text-accent transition-colors">
                  {engagement.transaction.name}
                </Link>
              </dd>
            </div>

            {engagement.lastContact && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Last Contact</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">
                  {formatDate(engagement.lastContact)}{" "}
                  <span className="text-[var(--text-tertiary)]">({daysAgoLabel(engagement.lastContact)})</span>
                </dd>
              </div>
            )}

            {engagement.owner && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Owner</dt>
                <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">{engagement.owner.name}</dd>
              </div>
            )}

            {engagement.notes && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Notes</dt>
                <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{engagement.notes}</dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      {/* NDA */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">NDA</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Deal NDA</dt>
              <dd className="mt-1">
                {engagement.ndaType ? (
                  <div className="flex items-center gap-2">
                    <Chip value={engagement.ndaType} group="NdaType" />
                    {engagement.ndaSignedAt && (
                      <span className="text-xs text-[var(--text-tertiary)]">{formatDate(engagement.ndaSignedAt)}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-[var(--text-tertiary)]">No NDA recorded</span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Investor NDA Status</dt>
              <dd className="mt-1">
                <Chip value={engagement.investor.ndaStatus} group="InvestorNdaStatus" />
              </dd>
            </div>
          </dl>

          {engagement.ndaType == null && <RecordClosedNdaButton engagementId={engagement.id} />}

          <p className="text-xs text-[var(--text-tertiary)]">
            Stage changes past Teaser require an NDA (Open on the investor, or Closed here).
          </p>
        </CardBody>
      </Card>

      <MilestoneChecklist engagementId={engagement.id} items={milestoneItems} />

      <StageHistory stageGroup="EngagementStage" items={stageHistoryItems} />

      {/* Activity timeline */}
      <ActivityTimeline
        activities={activityItems}
        taskOptions={{ mandates: rel.mandates, transactions: rel.transactions, investors: rel.investors, clients: rel.clients, users: rel.users }}
      />
    </div>
  );
}
