// mandates/[id]/page.tsx — Mandate detail page.
// Server Component: fetches mandate with all relations, renders detail + restage control.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getMandate } from "@/server/services/mandates";
import { listDocuments } from "@/server/services/documents";
import { relationOptions } from "@/server/services/relation-options";
import { Avatar, Chip, Card, CardHeader, CardBody, Badge, Button } from "@/components/ui";
import { formatDate } from "@/lib/format";
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
import { FindProspectsButton } from "@/components/crm/find-prospects-button";
import { MandateFormDrawer } from "@/components/crm/mandate-form-drawer";
import { DeleteConfirm } from "@/components/crm/delete-confirm";
import { getOrgLens } from "@/server/rbac/context";
import { canDeleteRecord, canUpdateRecord } from "@/server/rbac/matrix";

// Next 16: params is a Promise
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MandateDetailPage({ params }: PageProps) {
  const { id } = await params;
  const mandate = await getMandate(id);

  if (!mandate) notFound();

  const [rel, documents] = await Promise.all([
    relationOptions(),
    listDocuments({ mandateId: id }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = mandate as any;

  const toDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
  const initial = {
    id: m.id,
    name: m.name,
    clientId: m.clientId ?? "",
    leadId: m.leadId ?? "",
    referredById: m.referredById ?? "",
    dealStatus: m.dealStatus ?? "",
    dealSize: m.dealSize == null ? undefined : Number(m.dealSize),
    sector: (m.sector ?? []) as string[],
    source: m.source ?? "",
    dateOpened: toDate(m.dateOpened),
    ndaStatus: m.ndaStatus ?? "",
    eaStatus: m.eaStatus ?? "",
    nextAction: m.nextAction ?? "",
    notes: m.notes ?? "",
  };
  const DELETE_MANDATE = `mutation DeleteMandate($id: ID!) { deleteMandate(id: $id) { id } }`;

  // §7.2 lens: Deal Leads edit only mandates they lead; only Admin deletes.
  const lens = await getOrgLens();
  const mayEdit = canUpdateRecord(lens.orgRole, "Mandates", lens.userId, { leadId: m.leadId });
  const mayDelete = canDeleteRecord(lens.orgRole, "Mandates");

  const clientName: string = m.client?.name ?? m.name;
  const leadName: string | null = m.lead?.name ?? null;
  const leadColor: string | null = m.lead?.avatarColor ?? null;
  const referredBy: string | null = m.referredBy?.name ?? null;
  const sectors: string[] = m.sector ?? [];

  const stageOptions = options("MandateStage");

  // Task 13: Deal-summary header panel — plain DTO built here (no Prisma
  // types/Decimals cross the RSC boundary into the presentational panel).
  // Mandate has no `assistant` relation (only Transaction does).
  const dealSummary: DealSummaryProps = {
    kind: "mandate",
    statusLabel: label("DealStatus", m.dealStatus),
    statusValue: m.dealStatus ?? null,
    stageLabel: label("MandateStage", m.stage),
    daysInStage: daysInStage(m.stageEnteredAt ?? new Date()),
    leadName,
    assistantName: null,
    nextAction: m.nextAction ?? null,
    dateOnboarded: m.dateOpened ? m.dateOpened.toISOString() : null,
    dealSize: m.dealSize != null ? Number(m.dealSize) : null,
    sectors,
    ndaStatusLabel: label("DocStatus", m.ndaStatus),
    eaStatusLabel: label("DocStatus", m.eaStatus),
    referrer: referredBy,
  };

  // Task 14: Documents-by-stage panel — plain DTO from the already-loaded
  // `documents` array (no second fetch) + the mandate's NDA/EA date-pair
  // status. Mandates have no `vdrLink` (Transaction-only), so Data Room
  // always renders as not-linked here.
  const docsByStage: DocsByStageProps = {
    documents: documents.map((doc) => ({
      id: doc.id,
      type: doc.type,
      typeLabel: label("DocumentType", doc.type),
      statusLabel: label("DocumentStatus", doc.status),
      statusValue: doc.status ?? "",
      href: doc.fileUrl ?? null,
    })),
    ndaStatusLabel: label("DocStatus", m.ndaStatus),
    ndaStatusValue: m.ndaStatus ?? "",
    eaStatusLabel: label("DocStatus", m.eaStatus),
    eaStatusValue: m.eaStatus ?? "",
    vdrLinked: false,
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/mandates" className="hover:text-zinc-700 transition-colors">
          Mandates
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
            <Chip value={m.stage} group="MandateStage" />
            {m.dealStatus && <Chip value={m.dealStatus} group="DealStatus" />}
          </div>
          {m.name && m.name !== clientName && (
            <p className="mt-1 text-sm text-zinc-500">{m.name}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <FindProspectsButton mandateId={m.id} />
          <Button variant="secondary" size="sm" disabled>
            Export
          </Button>
          {mayEdit && (
            <MandateFormDrawer mode="edit" initial={initial} clients={rel.clients} users={rel.users} partners={rel.partners} />
          )}
          {mayDelete && (
            <DeleteConfirm mutation={DELETE_MANDATE} recordId={m.id} entityLabel="mandate" redirectTo="/mandates" />
          )}
        </div>
      </div>

      {/* Deal-summary header panel (Task 13) */}
      <DealSummaryPanel {...dealSummary} />

      {/* Documents-by-stage panel (Task 14) */}
      <DocumentsByStage {...docsByStage} />

      {/* Restage control + key facts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Key facts */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-sm font-semibold text-zinc-900">Key Facts</h2>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {/* Sector chips */}
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Sector</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {sectors.length > 0
                    ? sectors.map((s) => <Chip key={s} value={s} group="Sector" />)
                    : <span className="text-sm text-zinc-400">—</span>}
                </dd>
              </div>

              {/* Lead (owner) */}
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Lead</dt>
                <dd className="mt-1 flex items-center gap-2">
                  {leadName ? (
                    <>
                      <Avatar name={leadName} color={leadColor ?? undefined} size="sm" />
                      <span className="text-sm font-medium text-zinc-900">{leadName}</span>
                    </>
                  ) : (
                    <span className="text-sm text-zinc-400">—</span>
                  )}
                </dd>
              </div>

              {/* Referred by */}
              {referredBy && (
                <div>
                  <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Referred By</dt>
                  <dd className="mt-1 text-sm font-medium text-zinc-900">{referredBy}</dd>
                </div>
              )}

              {/* Next action */}
              {m.nextAction && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Next Action</dt>
                  <dd className="mt-1 text-sm text-zinc-900">{m.nextAction}</dd>
                </div>
              )}

              {/* Stage entered */}
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Stage Since</dt>
                <dd className="mt-1 text-sm text-zinc-900">{formatDate(m.stageEnteredAt)}</dd>
              </div>

              {/* Created */}
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Created</dt>
                <dd className="mt-1 text-sm text-zinc-900">{formatDate(m.createdAt)}</dd>
              </div>

              {/* Notes */}
              {m.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Notes</dt>
                  <dd className="mt-1 text-sm text-zinc-700 whitespace-pre-line">{m.notes}</dd>
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
                  kind="mandate"
                  id={m.id}
                  currentStage={m.stage}
                  stageOptions={stageOptions}
                />
                <p className="mt-3 text-xs text-zinc-400">
                  Changing stage immediately persists to the database and resets the stage timer.
                </p>
              </>
            ) : (
              <>
                <Chip value={m.stage} group="MandateStage" />
                <p className="mt-3 text-xs text-zinc-400">Read-only in current view.</p>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Related transactions */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">
            Transactions
            {m.transactions?.length > 0 && (
              <Badge tone="neutral" className="ml-2">{m.transactions.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {!m.transactions || m.transactions.length === 0 ? (
            <p className="text-sm text-zinc-400">No transactions linked to this mandate.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {m.transactions.map((txn: { id: string; name: string; stage: string }) => (
                <li key={txn.id} className="py-3 flex items-center justify-between gap-4">
                  <Link
                    href={`/transactions/${txn.id}`}
                    className="text-sm font-medium text-zinc-900 hover:text-accent transition-colors"
                  >
                    {txn.name}
                  </Link>
                  <Chip value={txn.stage} group="TransactionStage" />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Documents linked to this deal (spec §3.9 linked record = Deal) */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">
            Documents
            {documents.length > 0 && <Badge tone="neutral" className="ml-2">{documents.length}</Badge>}
          </h2>
        </CardHeader>
        <CardBody>
          {documents.length === 0 ? (
            <p className="text-sm text-zinc-400">No documents linked to this mandate.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {documents.map((doc) => (
                <li key={doc.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    {doc.fileUrl ? (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-zinc-900 hover:text-accent transition-colors truncate block">
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

      <StageHistory
        stageGroup="MandateStage"
        items={(m.stageChanges ?? []).map((s: { id: string; field: string; fromValue: string | null; toValue: string; changedAt: Date; changedBy?: { name: string } | null; createdSource: string }): StageHistoryItem => ({
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
        activities={(m.activities ?? []).map((a: { id: string; type: string; subject?: string | null; body?: string | null; occurredAt: Date; channel?: string | null; direction?: string | null }): ActivityTimelineItem => ({
          id: a.id,
          type: a.type,
          subject: a.subject,
          body: a.body,
          occurredAt: a.occurredAt,
          channel: a.channel,
          direction: a.direction,
        }))}
      />
    </div>
  );
}
