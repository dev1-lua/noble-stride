// advisory/[id]/page.tsx — Advisory engagement detail page.
// Server Component: fetches the engagement with relations, renders detail +
// restage control. Simplified sibling of mandates/[id] (no journey spine,
// NDA/EA docs panels, or intake review — those are mandate-specific).

import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdvisory } from "@/server/services/advisory";
import { listDocuments } from "@/server/services/documents";
import { relationOptions } from "@/server/services/relation-options";
import { Avatar, Chip, Card, CardHeader, CardBody, Badge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { label, options } from "@/lib/vocab";
import { RestageSelect } from "@/components/crm/restage-select";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import type { ActivityTimelineItem } from "@/components/crm/activity-timeline";
import { StageHistory } from "@/components/crm/stage-history";
import type { StageHistoryItem } from "@/components/crm/stage-history";
import { AdvisoryFormDrawer } from "@/components/crm/advisory-form-drawer";
import { DeleteConfirm } from "@/components/crm/delete-confirm";
import { getOrgLens } from "@/server/rbac/context";
import { canDeleteRecord, canUpdateRecord } from "@/server/rbac/matrix";

// Next 16: params is a Promise
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdvisoryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const advisory = await getAdvisory(id);

  if (!advisory) notFound();

  const [rel, documents] = await Promise.all([
    relationOptions(),
    listDocuments({ advisoryId: id }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = advisory as any;

  const toDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
  const initial = {
    id: a.id,
    name: a.name,
    clientId: a.clientId ?? "",
    leadId: a.leadId ?? "",
    assistIds: ((a.assists ?? []) as { id: string }[]).map((u) => u.id),
    stage: a.stage ?? "",
    dealStatus: a.dealStatus ?? "",
    feeAmount: a.feeAmount == null ? undefined : Number(a.feeAmount),
    sector: (a.sector ?? []) as string[],
    country: a.country ?? "",
    source: a.source ?? "",
    dateOpened: toDate(a.dateOpened),
    nextAction: a.nextAction ?? "",
    notes: a.notes ?? "",
    priority: a.priority ?? "",
  };
  const DELETE_ADVISORY = `mutation DeleteAdvisory($id: ID!) { deleteAdvisory(id: $id) { id } }`;

  // §7.2 lens: Deal Leads edit only engagements they lead; only Admin deletes.
  const lens = await getOrgLens();
  const mayEdit = canUpdateRecord(lens.orgRole, "Advisory", lens.userId, { leadId: a.leadId });
  const mayDelete = canDeleteRecord(lens.orgRole, "Advisory");

  const clientName: string = a.client?.name ?? a.name;
  const leadName: string | null = a.lead?.name ?? null;
  const leadColor: string | null = a.lead?.avatarColor ?? null;
  const assists: { id: string; name: string; avatarColor: string | null }[] = a.assists ?? [];
  const sectors: string[] = a.sector ?? [];

  const stageOptions = options("AdvisoryStage");

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Link href="/deals?type=advisory" className="hover:text-[var(--text-secondary)] transition-colors">
          Advisory
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
            <Chip value={a.stage} group="AdvisoryStage" />
            {a.dealStatus && <Chip value={a.dealStatus} group="DealStatus" />}
          </div>
          {a.name && a.name !== clientName && (
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">{a.name}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {mayEdit && (
            <AdvisoryFormDrawer mode="edit" initial={initial} clients={rel.clients} users={rel.users} />
          )}
          {mayDelete && (
            <DeleteConfirm mutation={DELETE_ADVISORY} recordId={a.id} entityLabel="advisory engagement" redirectTo="/deals?type=advisory" />
          )}
        </div>
      </div>

      {/* Key facts + restage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Key Facts</h2>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Sector</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {sectors.length > 0
                    ? sectors.map((s) => <Chip key={s} value={s} group="Sector" />)
                    : <span className="text-sm text-[var(--text-tertiary)]">—</span>}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Deal Lead</dt>
                <dd className="mt-1 flex items-center gap-2">
                  {leadName ? (
                    <>
                      <Avatar name={leadName} color={leadColor ?? undefined} size="sm" />
                      <span className="text-sm font-medium text-[var(--text-primary)]">{leadName}</span>
                    </>
                  ) : (
                    <span className="text-sm text-[var(--text-tertiary)]">—</span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Deal Assists</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  {assists.length > 0 ? (
                    assists.map((u) => (
                      <span key={u.id} className="flex items-center gap-1.5">
                        <Avatar name={u.name} color={u.avatarColor ?? undefined} size="sm" />
                        <span className="text-sm font-medium text-[var(--text-primary)]">{u.name}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[var(--text-tertiary)]">—</span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Country</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{a.country ?? "—"}</dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Fee</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">
                  {a.feeAmount != null ? `${formatMoney(Number(a.feeAmount))} ${a.currency}` : "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Source</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{a.source ? label("Source", a.source) : "—"}</dd>
              </div>

              {a.nextAction && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Next Action</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)]">{a.nextAction}</dd>
                </div>
              )}

              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Stage Since</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{formatDate(a.stageEnteredAt)}</dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Created</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{formatDate(a.createdAt)}</dd>
              </div>

              {a.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Notes</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{a.notes}</dd>
                </div>
              )}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Stage</h2>
          </CardHeader>
          <CardBody>
            {mayEdit ? (
              <>
                <RestageSelect
                  kind="advisory"
                  id={a.id}
                  currentStage={a.stage}
                  stageOptions={stageOptions}
                />
                <p className="mt-3 text-xs text-[var(--text-tertiary)]">
                  Changing stage immediately persists to the database and resets the stage timer.
                </p>
              </>
            ) : (
              <>
                <Chip value={a.stage} group="AdvisoryStage" />
                <p className="mt-3 text-xs text-[var(--text-tertiary)]">Read-only in current view.</p>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Documents linked to this engagement */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Documents
            {documents.length > 0 && <Badge tone="neutral" className="ml-2">{documents.length}</Badge>}
          </h2>
        </CardHeader>
        <CardBody>
          {documents.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No documents linked to this engagement.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {documents.map((doc) => (
                <li key={doc.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    {doc.fileUrl ? (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[var(--text-primary)] hover:text-accent transition-colors truncate block">
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
        stageGroup="AdvisoryStage"
        items={(a.stageChanges ?? []).map((s: { id: string; field: string; fromValue: string | null; toValue: string; changedAt: Date; changedBy?: { name: string } | null; createdSource: string }): StageHistoryItem => ({
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
        activities={(a.activities ?? []).map((act: { id: string; type: string; subject?: string | null; body?: string | null; occurredAt: Date; channel?: string | null; direction?: string | null }): ActivityTimelineItem => ({
          id: act.id,
          type: act.type,
          subject: act.subject,
          body: act.body,
          occurredAt: act.occurredAt,
          channel: act.channel,
          direction: act.direction,
        }))}
      />
    </div>
  );
}
