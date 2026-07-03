// transactions/[id]/page.tsx — Transaction detail page.
// Server Component: fetches transaction with all relations, renders detail + restage control.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getTransaction } from "@/server/services/transactions";
import { listDocuments } from "@/server/services/documents";
import { listDDTracks } from "@/server/services/due-diligence";
import { listServiceProviders } from "@/server/services/service-providers";
import { relationOptions } from "@/server/services/relation-options";
import { DDTrack } from "@prisma/client";
import { DDTracksPanel, type DDTrackRow } from "@/components/crm/dd-tracks-panel";
import { Avatar, Chip, Card, CardHeader, CardBody, Badge, Button } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { label, options } from "@/lib/vocab";
import { RestageSelect } from "@/components/crm/restage-select";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import type { ActivityTimelineItem } from "@/components/crm/activity-timeline";
import { MatchInvestorsButton } from "@/components/crm/match-investors-button";
import { PrepMilestones } from "@/components/crm/prep-milestones";
import { PREP_MILESTONES } from "@/lib/milestones";
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

  const [rel, documents, ddTracks, serviceProviders] = await Promise.all([
    relationOptions(),
    listDocuments({ transactionId: id }),
    listDDTracks(id),
    listServiceProviders(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txn = transaction as any;

  const toDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
  const initial = {
    id: txn.id,
    name: txn.name,
    clientId: txn.clientId ?? "",
    mandateId: txn.mandateId ?? "",
    ownerId: txn.ownerId ?? "",
    dealType: txn.dealType ?? "",
    instrument: (txn.instrument ?? []) as string[],
    targetRaise: txn.targetRaise == null ? undefined : Number(txn.targetRaise),
    sector: (txn.sector ?? []) as string[],
    dateOpened: toDate(txn.dateOpened),
    successFeeAmount: txn.successFeeAmount == null ? undefined : Number(txn.successFeeAmount),
    successFeeInvoicedDate: toDate(txn.successFeeInvoicedDate),
    successFeePaidDate: toDate(txn.successFeePaidDate),
    icFirstApprovalDate: toDate(txn.icFirstApprovalDate),
    icSecondApprovalDate: toDate(txn.icSecondApprovalDate),
    cakComesaStatus: txn.cakComesaStatus ?? "",
    cakComesaFiledDate: toDate(txn.cakComesaFiledDate),
    cakComesaApprovedDate: toDate(txn.cakComesaApprovedDate),
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
  const mandateName: string | null = txn.mandate?.name ?? null;
  const sectors: string[] = txn.sector ?? [];
  const instruments: string[] = txn.instrument ?? [];
  const targetRaiseNum = txn.targetRaise != null ? Number(txn.targetRaise) : null;
  const dealTypeName = txn.dealType ? label("DealType", txn.dealType) : null;

  const stageOptions = options("TransactionStage");

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/transactions" className="hover:text-zinc-700 transition-colors">
          Transactions
        </Link>
        <span>/</span>
        <span className="text-zinc-900 font-medium">{clientName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar name={clientName} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900 leading-tight">{clientName}</h1>
            <Chip value={txn.stage} group="TransactionStage" />
          </div>
          {dealTypeName && (
            <p className="mt-1 text-sm text-zinc-500">{dealTypeName}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <MatchInvestorsButton transactionId={txn.id} />
          <Button variant="secondary" size="sm" disabled>
            Export
          </Button>
          {mayEdit && (
            <TransactionFormDrawer mode="edit" initial={initial} clients={rel.clients} users={rel.users} mandates={rel.mandates} />
          )}
          {mayDelete && (
            <DeleteConfirm mutation={DELETE_TRANSACTION} recordId={txn.id} entityLabel="transaction" redirectTo="/transactions" />
          )}
        </div>
      </div>

      {/* Restage control + key facts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Key facts */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-sm font-semibold text-zinc-900">Deal Facts</h2>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {/* Sector */}
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Sector</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {sectors.length > 0
                    ? sectors.map((s) => <Chip key={s} value={s} group="Sector" />)
                    : <span className="text-sm text-zinc-400">—</span>}
                </dd>
              </div>

              {/* Instruments */}
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Instrument</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {instruments.length > 0
                    ? instruments.map((inst) => <Chip key={inst} value={inst} group="Instrument" />)
                    : <span className="text-sm text-zinc-400">—</span>}
                </dd>
              </div>

              {/* Target raise */}
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Target Raise</dt>
                <dd className="mt-1 text-sm font-bold text-zinc-900">
                  {targetRaiseNum != null ? formatMoney(targetRaiseNum) : "—"}
                </dd>
              </div>

              {/* Owner */}
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Owner</dt>
                <dd className="mt-1 flex items-center gap-2">
                  {ownerName ? (
                    <>
                      <Avatar name={ownerName} color={ownerColor ?? undefined} size="sm" />
                      <span className="text-sm font-medium text-zinc-900">{ownerName}</span>
                    </>
                  ) : (
                    <span className="text-sm text-zinc-400">—</span>
                  )}
                </dd>
              </div>

              {/* Mandate link */}
              {mandateName && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Mandate</dt>
                  <dd className="mt-1 text-sm font-medium text-zinc-900">{mandateName}</dd>
                </div>
              )}

              {/* Date opened */}
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Opened</dt>
                <dd className="mt-1 text-sm text-zinc-900">{formatDate(txn.dateOpened) || "—"}</dd>
              </div>

              {/* Closed at */}
              {txn.closedAt && (
                <div>
                  <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Closed</dt>
                  <dd className="mt-1 text-sm text-zinc-900">{formatDate(txn.closedAt)}</dd>
                </div>
              )}

              {/* Stage since */}
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Stage Since</dt>
                <dd className="mt-1 text-sm text-zinc-900">{formatDate(txn.stageEnteredAt)}</dd>
              </div>

              {/* Success fee */}
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Success Fee</dt>
                <dd className="mt-1 text-sm font-bold text-zinc-900">
                  {txn.successFeeAmount != null ? formatMoney(Number(txn.successFeeAmount)) : "—"}
                </dd>
                {(txn.successFeeInvoicedDate || txn.successFeePaidDate) && (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {txn.successFeeInvoicedDate && <>Invoiced {formatDate(txn.successFeeInvoicedDate)}</>}
                    {txn.successFeeInvoicedDate && txn.successFeePaidDate && " · "}
                    {txn.successFeePaidDate && <>Paid {formatDate(txn.successFeePaidDate)}</>}
                  </p>
                )}
              </div>

              {/* IC approvals */}
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">IC Approvals</dt>
                <dd className="mt-1 text-sm text-zinc-900">
                  {txn.icFirstApprovalDate || txn.icSecondApprovalDate ? (
                    <>
                      {txn.icFirstApprovalDate && <>First {formatDate(txn.icFirstApprovalDate)}</>}
                      {txn.icFirstApprovalDate && txn.icSecondApprovalDate && " · "}
                      {txn.icSecondApprovalDate && <>Second {formatDate(txn.icSecondApprovalDate)}</>}
                    </>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </dd>
              </div>

              {/* CAK / COMESA */}
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">CAK / COMESA</dt>
                <dd className="mt-1 text-sm text-zinc-900">
                  {label("RegulatoryStatus", txn.cakComesaStatus)}
                </dd>
                {(txn.cakComesaFiledDate || txn.cakComesaApprovedDate) && (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {txn.cakComesaFiledDate && <>Filed {formatDate(txn.cakComesaFiledDate)}</>}
                    {txn.cakComesaFiledDate && txn.cakComesaApprovedDate && " · "}
                    {txn.cakComesaApprovedDate && <>Approved {formatDate(txn.cakComesaApprovedDate)}</>}
                  </p>
                )}
              </div>

              {/* Notes */}
              {txn.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Notes</dt>
                  <dd className="mt-1 text-sm text-zinc-700 whitespace-pre-line">{txn.notes}</dd>
                </div>
              )}
            </dl>
          </CardBody>
        </Card>

        {/* Restage panel */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-zinc-900">Stage</h2>
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
                <p className="mt-3 text-xs text-zinc-400">
                  Changing stage immediately persists to the database and resets the stage timer.
                </p>
              </>
            ) : (
              <>
                <Chip value={txn.stage} group="TransactionStage" />
                <p className="mt-3 text-xs text-zinc-400">Read-only in current view.</p>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Engagements */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">
            Investor Engagements
            {txn.engagements?.length > 0 && (
              <Badge tone="neutral" className="ml-2">{txn.engagements.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {!txn.engagements || txn.engagements.length === 0 ? (
            <p className="text-sm text-zinc-400">No investor engagements recorded.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {txn.engagements.map((eng: { id: string; investor: { id: string; name: string }; status: string; notes?: string | null }) => (
                <li key={eng.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={eng.investor.name} size="sm" />
                    <div className="min-w-0">
                      <Link
                        href={`/investors/${eng.investor.id}`}
                        className="text-sm font-medium text-zinc-900 hover:text-accent transition-colors"
                      >
                        {eng.investor.name}
                      </Link>
                      {eng.notes && (
                        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{eng.notes}</p>
                      )}
                    </div>
                  </div>
                  <Chip value={eng.status} group="EngagementStatus" />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Deal preparation checklist — derived from the document register */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">
            Deal Preparation
            <Badge tone="neutral" className="ml-2">
              {PREP_MILESTONES.filter((m) => documents.some((d) => d.type === m.docType)).length}
              /{PREP_MILESTONES.length}
            </Badge>
          </h2>
        </CardHeader>
        <CardBody>
          <PrepMilestones docTypes={documents.map((d) => d.type)} />
          <p className="mt-3 text-xs text-zinc-400">
            Derived from the document register: a milestone is complete once a document of the
            matching type is linked to this transaction.
          </p>
        </CardBody>
      </Card>

      {/* Due-diligence workstreams (§6.2) */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">
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
            <ul className="divide-y divide-zinc-100">
              {ddRows.map((row) => (
                <li key={row.track} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="text-sm font-medium text-zinc-900">{label("DDTrack", row.track)}</span>
                  <Chip value={row.status} group="DDStatus" />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-zinc-400">
            Deal-level workstreams (financial / tax / commercial / ESG / legal). Internal only —
            never shared with investors or partners.
          </p>
        </CardBody>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">
            Documents
            {documents.length > 0 && (
              <Badge tone="neutral" className="ml-2">{documents.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {documents.length === 0 ? (
            <p className="text-sm text-zinc-400">No documents linked to this transaction.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {documents.map((doc) => (
                <li key={doc.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    {doc.fileUrl ? (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-zinc-900 hover:text-accent transition-colors truncate block"
                      >
                        {doc.name}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-zinc-900 truncate">{doc.name}</p>
                    )}
                    <p className="mt-0.5 text-xs text-zinc-500">
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

      <ActivityTimeline
        activities={(txn.activities ?? []).map((a: { id: string; type: string; subject?: string | null; occurredAt: Date }): ActivityTimelineItem => ({
          id: a.id,
          type: a.type,
          subject: a.subject,
          occurredAt: a.occurredAt,
        }))}
      />
    </div>
  );
}
