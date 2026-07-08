// transactions/[id]/page.tsx — Transaction detail page.
// Server Component: fetches transaction with all relations, renders detail + restage control.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getTransaction } from "@/server/services/transactions";
import { listDocuments } from "@/server/services/documents";
import { listDDTracks } from "@/server/services/due-diligence";
import { listServiceProviders } from "@/server/services/service-providers";
import { journeyForMandate } from "@/server/services/journey";
import { relationOptions } from "@/server/services/relation-options";
import { DealJourney } from "@/components/crm/deal-journey";
import { DDTrack } from "@prisma/client";
import { DDTracksPanel, type DDTrackRow } from "@/components/crm/dd-tracks-panel";
import { Avatar, Chip, Card, CardHeader, CardBody, Badge, Button } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { label, options } from "@/lib/vocab";
import { daysInStage } from "@/server/domain/metrics";
import { RestageSelect } from "@/components/crm/restage-select";
import { DealSummaryPanel } from "@/components/crm/deal-summary-panel";
import type { DealSummaryProps } from "@/components/crm/deal-summary-panel";
import { DocumentsByStage } from "@/components/crm/documents-by-stage";
import type { DocsByStageProps } from "@/components/crm/documents-by-stage";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import type { ActivityTimelineItem } from "@/components/crm/activity-timeline";
import { StageHistory } from "@/components/crm/stage-history";
import type { StageHistoryItem } from "@/components/crm/stage-history";
import { MatchInvestorsButton } from "@/components/crm/match-investors-button";
import { PrepMilestones } from "@/components/crm/prep-milestones";
import { visiblePrepMilestones } from "@/lib/milestones";
import { TransactionFormDrawer } from "@/components/crm/transaction-form-drawer";
import { DeleteConfirm } from "@/components/crm/delete-confirm";
import { getOrgLens } from "@/server/rbac/context";
import { canDeleteRecord, canUpdateRecord } from "@/server/rbac/matrix";

// Next 16: params is a Promise
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TransactionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const lens = await getOrgLens();
  const transaction = await getTransaction(id);

  if (!transaction) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txn = transaction as any;

  const [rel, documents, ddTracks, serviceProviders, journeySteps] = await Promise.all([
    relationOptions(),
    listDocuments({ transactionId: id }),
    listDDTracks(id),
    listServiceProviders(),
    // Skip entirely when this transaction has no linked mandate.
    txn.mandateId ? journeyForMandate(txn.mandateId) : Promise.resolve(null),
  ]);

  const toDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
  const initial = {
    id: txn.id,
    name: txn.name,
    clientId: txn.clientId ?? "",
    mandateId: txn.mandateId ?? "",
    ownerId: txn.ownerId ?? "",
    assistantId: txn.assistantId ?? "",
    dealType: txn.dealType ?? "",
    instrument: (txn.instrument ?? []) as string[],
    targetRaise: txn.targetRaise == null ? undefined : Number(txn.targetRaise),
    sector: (txn.sector ?? []) as string[],
    dateOpened: toDate(txn.dateOpened),
    successFeeAmount: txn.successFeeAmount == null ? undefined : Number(txn.successFeeAmount),
    successFeeInvoicedDate: toDate(txn.successFeeInvoicedDate),
    successFeePaidDate: toDate(txn.successFeePaidDate),
    // Spec-gap: deal status/milestone/financing fields (spec §4.1/§4.3/§4.5/§4.7)
    dealStatus: txn.dealStatus ?? "",
    dealMilestone: txn.dealMilestone ?? "",
    financingType: txn.financingType ?? "",
    maxSellingStake: txn.maxSellingStake ?? "",
    targetProfile: txn.targetProfile ?? "",
    useOfFunds: txn.useOfFunds ?? "",
    vdrLink: txn.vdrLink ?? "",
    probability: txn.probability == null ? undefined : Number(txn.probability),
    notes: txn.notes ?? "",
    referredById: txn.referredById ?? "",
    serviceProviderIds: (txn.serviceProviders ?? []).map((sp: { id: string }) => sp.id),
    icFirstApprovalDate: toDate(txn.icFirstApprovalDate),
    icSecondApprovalDate: toDate(txn.icSecondApprovalDate),
    cakComesaStatus: txn.cakComesaStatus ?? "",
    cakComesaFiledDate: toDate(txn.cakComesaFiledDate),
    cakComesaApprovedDate: toDate(txn.cakComesaApprovedDate),
    // Task 8: priority + partner fee tracking (Task 6 migration)
    priority: txn.priority ?? "",
    partnerFeeStatus: txn.partnerFeeStatus ?? "",
    partnerFeeAmount: txn.partnerFeeAmount == null ? undefined : Number(txn.partnerFeeAmount),
  };

  // §6.2 DD workstreams: one row per track, whether or not a DB row exists yet.
  const ddByTrack = new Map(ddTracks.map((t) => [t.track, t]));
  const ddRows: DDTrackRow[] = Object.values(DDTrack).map((track) => {
    const row = ddByTrack.get(track);
    return {
      track,
      status: row?.status ?? "NotStarted",
      ownerId: row?.ownerId ?? "",
      serviceProviderId: row?.serviceProviderId ?? "",
      startedAt: toDate(row?.startedAt),
      completedAt: toDate(row?.completedAt),
      notes: row?.notes ?? "",
    };
  });
  const DELETE_TRANSACTION = `mutation DeleteTransaction($id: ID!) { deleteTransaction(id: $id) { id } }`;

  // §7.2 lens: Deal Leads edit only their own transactions; only Admin deletes.
  const mayEdit = canUpdateRecord(lens.orgRole, "Transactions", lens.userId, { ownerId: txn.ownerId });
  const mayDelete = canDeleteRecord(lens.orgRole, "Transactions");

  const clientName: string = txn.client?.name ?? txn.name;
  const ownerName: string | null = txn.owner?.name ?? null;
  const ownerColor: string | null = txn.owner?.avatarColor ?? null;
  const assistantName: string | null = txn.assistant?.name ?? null;
  const assistantColor: string | null = txn.assistant?.avatarColor ?? null;
  const mandateName: string | null = txn.mandate?.name ?? null;
  const sectors: string[] = txn.sector ?? [];
  const instruments: string[] = txn.instrument ?? [];
  const targetRaiseNum = txn.targetRaise != null ? Number(txn.targetRaise) : null;
  const dealTypeName = txn.dealType ? label("DealType", txn.dealType) : null;
  const probabilityNum: number | null = txn.probability != null ? Number(txn.probability) : null;

  const stageOptions = options("TransactionStage");

  // Task 13: Deal-summary header panel — plain DTO built here (no Prisma
  // types/Decimals cross the RSC boundary into the presentational panel).
  // Transaction has no `lead` relation — `owner` is the lead-equivalent
  // (see src/server/services/deals-queue.ts for the same convention).
  const engagementsList: { totalAmount: unknown; amountDisbursed: unknown; amountPending: unknown }[] =
    txn.engagements ?? [];
  const engagementRollup =
    engagementsList.length > 0
      ? engagementsList.reduce(
          (acc, e) => ({
            investors: acc.investors + 1,
            total: acc.total + (e.totalAmount != null ? Number(e.totalAmount) : 0),
            disbursed: acc.disbursed + (e.amountDisbursed != null ? Number(e.amountDisbursed) : 0),
            pending: acc.pending + (e.amountPending != null ? Number(e.amountPending) : 0),
          }),
          { investors: 0, total: 0, disbursed: 0, pending: 0 }
        )
      : null;

  const dealSummary: DealSummaryProps = {
    kind: "transaction",
    statusLabel: txn.dealStatus ? label("DealStatus", txn.dealStatus) : "",
    statusValue: txn.dealStatus ?? null,
    stageLabel: label("TransactionStage", txn.stage),
    daysInStage: daysInStage(txn.stageEnteredAt ?? new Date()),
    leadName: ownerName,
    assistantName,
    nextAction: null, // Transaction has no next-action field (mandate-only)
    dateOnboarded: txn.dateOpened ? txn.dateOpened.toISOString() : null,
    targetRaise: targetRaiseNum,
    instruments,
    milestoneLabel: txn.dealMilestone ? label("DealMilestone", txn.dealMilestone) : undefined,
    probability: probabilityNum,
    engagement: engagementRollup,
    priorityValue: txn.priority ?? null,
  };

  // Task 14: Documents-by-stage panel — plain DTO from the already-loaded
  // `documents` array (no second fetch). NDA/EA status is derived from the
  // linked mandate when present, else "Not sent" (DocStatus default).
  const mandateNdaStatus: string = txn.mandate?.ndaStatus ?? "NotSent";
  const mandateEaStatus: string = txn.mandate?.eaStatus ?? "NotSent";
  const docsByStage: DocsByStageProps = {
    documents: documents.map((doc) => ({
      id: doc.id,
      type: doc.type,
      typeLabel: label("DocumentType", doc.type),
      statusLabel: label("DocumentStatus", doc.status),
      statusValue: doc.status ?? "",
      href: doc.fileUrl ?? null,
    })),
    ndaStatusLabel: label("DocStatus", mandateNdaStatus),
    ndaStatusValue: mandateNdaStatus,
    eaStatusLabel: label("DocStatus", mandateEaStatus),
    eaStatusValue: mandateEaStatus,
    vdrLinked: Boolean(txn.vdrLink),
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Link href="/transactions" className="hover:text-[var(--text-secondary)] transition-colors">
          Transactions
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">{clientName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar name={clientName} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">{clientName}</h1>
            <Chip value={txn.stage} group="TransactionStage" />
            {txn.dealStatus && <Chip value={txn.dealStatus} group="DealStatus" />}
          </div>
          {dealTypeName && (
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">{dealTypeName}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <MatchInvestorsButton transactionId={txn.id} />
          <Button variant="secondary" size="sm" disabled>
            Export
          </Button>
          {mayEdit && (
            <TransactionFormDrawer mode="edit" initial={initial} clients={rel.clients} users={rel.users} mandates={rel.mandates} partners={rel.partners} serviceProviders={rel.serviceProviders} />
          )}
          {mayDelete && (
            <DeleteConfirm mutation={DELETE_TRANSACTION} recordId={txn.id} entityLabel="transaction" redirectTo="/transactions" />
          )}
        </div>
      </div>

      {/* Deal journey spine (Task 16) — scoped to this transaction's mandate;
          renders nothing when the transaction has no linked mandate. */}
      {journeySteps && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Deal Journey</h2>
          </CardHeader>
          <CardBody>
            <DealJourney steps={journeySteps} />
          </CardBody>
        </Card>
      )}

      {/* Deal-summary header panel (Task 13) */}
      <DealSummaryPanel {...dealSummary} />

      {/* Documents-by-stage panel (Task 14) */}
      <DocumentsByStage {...docsByStage} />

      {/* Restage control + key facts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Key facts */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Deal Facts</h2>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {/* Sector */}
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Sector</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {sectors.length > 0
                    ? sectors.map((s) => <Chip key={s} value={s} group="Sector" />)
                    : <span className="text-sm text-[var(--text-tertiary)]">—</span>}
                </dd>
              </div>

              {/* Instruments */}
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Instrument</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {instruments.length > 0
                    ? instruments.map((inst) => <Chip key={inst} value={inst} group="Instrument" />)
                    : <span className="text-sm text-[var(--text-tertiary)]">—</span>}
                </dd>
              </div>

              {/* Target raise */}
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Target Raise</dt>
                <dd className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                  {targetRaiseNum != null ? formatMoney(targetRaiseNum) : "—"}
                </dd>
              </div>

              {/* Owner */}
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Owner</dt>
                <dd className="mt-1 flex items-center gap-2">
                  {ownerName ? (
                    <>
                      <Avatar name={ownerName} color={ownerColor ?? undefined} size="sm" />
                      <span className="text-sm font-medium text-[var(--text-primary)]">{ownerName}</span>
                    </>
                  ) : (
                    <span className="text-sm text-[var(--text-tertiary)]">—</span>
                  )}
                </dd>
              </div>

              {/* Assistant */}
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Assistant</dt>
                <dd className="mt-1 flex items-center gap-2">
                  {assistantName ? (
                    <>
                      <Avatar name={assistantName} color={assistantColor ?? undefined} size="sm" />
                      <span className="text-sm font-medium text-[var(--text-primary)]">{assistantName}</span>
                    </>
                  ) : (
                    <span className="text-sm text-[var(--text-tertiary)]">—</span>
                  )}
                </dd>
              </div>

              {/* Mandate link */}
              {mandateName && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Mandate</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">{mandateName}</dd>
                </div>
              )}

              {txn.referredBy && (
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Referred By</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)]">
                    <Link href={`/partners/${txn.referredBy.id}`} className="hover:text-accent transition-colors">{txn.referredBy.name}</Link>
                  </dd>
                </div>
              )}

              {/* Partner fee (Task 8) — only meaningful once a referrer is set */}
              {txn.referredBy && (
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Partner Fee</dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm text-[var(--text-primary)]">
                    {txn.partnerFeeStatus ? <Chip value={txn.partnerFeeStatus} group="PartnerFeeStatus" /> : <span className="text-[var(--text-tertiary)]">—</span>}
                    {txn.partnerFeeAmount != null && (
                      <span className="font-semibold">{formatMoney(Number(txn.partnerFeeAmount))}</span>
                    )}
                  </dd>
                </div>
              )}

              {/* Deal milestone */}
              {txn.dealMilestone && (
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Deal Milestone</dt>
                  <dd className="mt-1"><Chip value={txn.dealMilestone} group="DealMilestone" /></dd>
                </div>
              )}

              {/* Financing type ("Deal type") */}
              {txn.financingType && (
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Deal Type</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)]">{label("DealFinancingType", txn.financingType)}</dd>
                </div>
              )}

              {/* Max selling stake */}
              {txn.maxSellingStake && (
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Max Selling Stake</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)]">{label("MaxSellingStake", txn.maxSellingStake)}</dd>
                </div>
              )}

              {/* Probability */}
              {probabilityNum != null && (
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Probability</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)]">{probabilityNum}%</dd>
                </div>
              )}

              {/* VDR link */}
              {txn.vdrLink && (
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">VDR Link</dt>
                  <dd className="mt-1 text-sm">
                    <a href={txn.vdrLink} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline break-all">
                      {txn.vdrLink}
                    </a>
                  </dd>
                </div>
              )}

              {/* Date opened */}
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Opened</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{formatDate(txn.dateOpened) || "—"}</dd>
              </div>

              {/* Closed at */}
              {txn.closedAt && (
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Closed</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)]">{formatDate(txn.closedAt)}</dd>
                </div>
              )}

              {/* Stage since */}
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Stage Since</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{formatDate(txn.stageEnteredAt)}</dd>
              </div>

              {/* Success fee */}
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Success Fee</dt>
                <dd className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                  {txn.successFeeAmount != null ? formatMoney(Number(txn.successFeeAmount)) : "—"}
                </dd>
                {(txn.successFeeInvoicedDate || txn.successFeePaidDate) && (
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                    {txn.successFeeInvoicedDate && <>Invoiced {formatDate(txn.successFeeInvoicedDate)}</>}
                    {txn.successFeeInvoicedDate && txn.successFeePaidDate && " · "}
                    {txn.successFeePaidDate && <>Paid {formatDate(txn.successFeePaidDate)}</>}
                  </p>
                )}
              </div>

              {/* Target profile */}
              {txn.targetProfile && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Target Profile</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{txn.targetProfile}</dd>
                </div>
              )}

              {/* Use of funds */}
              {txn.useOfFunds && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Use of Funds</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{txn.useOfFunds}</dd>
                </div>
              )}
              {/* IC approvals */}
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">IC Approvals</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">
                  {txn.icFirstApprovalDate || txn.icSecondApprovalDate ? (
                    <>
                      {txn.icFirstApprovalDate && <>First {formatDate(txn.icFirstApprovalDate)}</>}
                      {txn.icFirstApprovalDate && txn.icSecondApprovalDate && " · "}
                      {txn.icSecondApprovalDate && <>Second {formatDate(txn.icSecondApprovalDate)}</>}
                    </>
                  ) : (
                    <span className="text-[var(--text-tertiary)]">—</span>
                  )}
                </dd>
              </div>

              {/* CAK / COMESA */}
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">CAK / COMESA</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">
                  {label("RegulatoryStatus", txn.cakComesaStatus)}
                </dd>
                {(txn.cakComesaFiledDate || txn.cakComesaApprovedDate) && (
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                    {txn.cakComesaFiledDate && <>Filed {formatDate(txn.cakComesaFiledDate)}</>}
                    {txn.cakComesaFiledDate && txn.cakComesaApprovedDate && " · "}
                    {txn.cakComesaApprovedDate && <>Approved {formatDate(txn.cakComesaApprovedDate)}</>}
                  </p>
                )}
              </div>

              {/* Notes */}
              {txn.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Notes</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{txn.notes}</dd>
                </div>
              )}
            </dl>
          </CardBody>
        </Card>

        {/* Restage panel */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Stage</h2>
          </CardHeader>
          <CardBody>
            {mayEdit ? (
              <>
                <RestageSelect
                  kind="transaction"
                  id={txn.id}
                  currentStage={txn.stage}
                  stageOptions={stageOptions}
                />
                <p className="mt-3 text-xs text-[var(--text-tertiary)]">
                  Changing stage immediately persists to the database and resets the stage timer.
                </p>
              </>
            ) : (
              <>
                <Chip value={txn.stage} group="TransactionStage" />
                <p className="mt-3 text-xs text-[var(--text-tertiary)]">Read-only in current view.</p>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Engagements */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Investor Engagements
            {txn.engagements?.length > 0 && (
              <Badge tone="neutral" className="ml-2">{txn.engagements.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {!txn.engagements || txn.engagements.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No investor engagements recorded.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {txn.engagements.map((eng: { id: string; investor: { id: string; name: string }; status: string; notes?: string | null }) => (
                <li key={eng.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={eng.investor.name} size="sm" />
                    <div className="min-w-0">
                      <Link
                        href={`/investors/${eng.investor.id}`}
                        className="text-sm font-medium text-[var(--text-primary)] hover:text-accent transition-colors"
                      >
                        {eng.investor.name}
                      </Link>
                      {eng.notes && (
                        <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-1">{eng.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Chip value={eng.status} group="EngagementStatus" />
                    <Link
                      href={`/engagement/${eng.id}`}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Open →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Service Providers engaged on this transaction (edit via the drawer above) */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Service Providers
            {txn.serviceProviders?.length > 0 && (
              <Badge tone="neutral" className="ml-2">{txn.serviceProviders.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {!txn.serviceProviders || txn.serviceProviders.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No service providers engaged on this transaction.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {txn.serviceProviders.map((sp: { id: string; name: string; type: string; contactPerson: string | null; status: string | null }) => (
                <li key={sp.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/service-providers`}
                      className="text-sm font-medium text-[var(--text-primary)] hover:text-accent transition-colors"
                    >
                      {sp.name}
                    </Link>
                    {sp.contactPerson && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{sp.contactPerson}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Chip value={sp.type} group="ServiceProviderType" />
                    {sp.status && <span className="text-xs text-[var(--text-tertiary)]">{sp.status}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Deal preparation checklist — derived from the document register */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Deal Preparation
            <Badge tone="neutral" className="ml-2">
              {visiblePrepMilestones(txn.financingType).filter((m) => documents.some((d) => d.type === m.docType)).length}
              /{visiblePrepMilestones(txn.financingType).length}
            </Badge>
          </h2>
        </CardHeader>
        <CardBody>
          <PrepMilestones docTypes={documents.map((d) => d.type)} financingType={txn.financingType} />
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">
            Derived from the document register: a milestone is complete once a document of the
            matching type is linked to this transaction.
          </p>
        </CardBody>
      </Card>

      {/* Due-diligence workstreams (§6.2) */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Due Diligence Workstreams
            <Badge tone="neutral" className="ml-2">
              {ddRows.filter((r) => r.status === "Complete").length}/{ddRows.length}
            </Badge>
          </h2>
        </CardHeader>
        <CardBody>
          {mayEdit ? (
            <DDTracksPanel
              transactionId={txn.id}
              tracks={ddRows}
              users={rel.users.map((u: { value: string; label: string }) => ({ id: u.value, name: u.label }))}
              serviceProviders={serviceProviders.map((p) => ({ id: p.id, name: p.name }))}
            />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {ddRows.map((row) => (
                <li key={row.track} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{label("DDTrack", row.track)}</span>
                  <Chip value={row.status} group="DDStatus" />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">
            Deal-level workstreams (financial / tax / commercial / ESG / legal). Internal only —
            never shared with investors or partners.
          </p>
        </CardBody>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Documents
            {documents.length > 0 && (
              <Badge tone="neutral" className="ml-2">{documents.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {documents.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No documents linked to this transaction.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {documents.map((doc) => (
                <li key={doc.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    {doc.fileUrl ? (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-[var(--text-primary)] hover:text-accent transition-colors truncate block"
                      >
                        {doc.name}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{doc.name}</p>
                    )}
                    <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                      {doc.version ? `${doc.version} · ` : ""}
                      Uploaded {formatDate(doc.uploadedAt)}
                      {doc.uploadedBy?.name ? ` by ${doc.uploadedBy.name}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Chip value={doc.type} group="DocumentType" />
                    <Chip value={doc.accessLevel} group="DocumentAccessLevel" />
                    {doc.status && <Chip value={doc.status} group="DocumentStatus" />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <StageHistory
        stageGroup="TransactionStage"
        items={(txn.stageChanges ?? []).map((s: { id: string; field: string; fromValue: string | null; toValue: string; changedAt: Date; changedBy?: { name: string } | null; createdSource: string }): StageHistoryItem => ({
          id: s.id,
          field: s.field,
          fromValue: s.fromValue,
          toValue: s.toValue,
          changedAt: s.changedAt,
          changedByName: s.changedBy?.name,
          createdSource: s.createdSource,
        }))}
      />

      <ActivityTimeline
        activities={(txn.activities ?? []).map((a: { id: string; type: string; subject?: string | null; body?: string | null; occurredAt: Date; channel?: string | null; direction?: string | null; investorId?: string | null; mandateId?: string | null; tasks?: { id: string; title: string; status: string }[] }): ActivityTimelineItem => ({
          id: a.id,
          type: a.type,
          subject: a.subject,
          body: a.body,
          occurredAt: a.occurredAt,
          channel: a.channel,
          direction: a.direction,
          links: { clientId: txn.clientId, transactionId: txn.id, investorId: a.investorId, mandateId: a.mandateId },
          tasks: (a.tasks ?? []).map((t) => ({ id: t.id, title: t.title, status: t.status })),
        }))}
        taskOptions={{ mandates: rel.mandates, transactions: rel.transactions, investors: rel.investors, clients: rel.clients, users: rel.users }}
      />
    </div>
  );
}
