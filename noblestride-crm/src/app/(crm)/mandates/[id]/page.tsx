// mandates/[id]/page.tsx — Mandate detail page.
// Server Component: fetches mandate with all relations, renders detail + restage control.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getMandate } from "@/server/services/mandates";
import { Avatar, Chip, Card, CardHeader, CardBody, Badge, Button } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { label, options } from "@/lib/vocab";
import { RestageSelect } from "@/components/crm/restage-select";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import type { ActivityTimelineItem } from "@/components/crm/activity-timeline";

// Next 16: params is a Promise
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MandateDetailPage({ params }: PageProps) {
  const { id } = await params;
  const mandate = await getMandate(id);

  if (!mandate) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = mandate as any;

  const clientName: string = m.client?.name ?? m.name;
  const leadName: string | null = m.lead?.name ?? null;
  const leadColor: string | null = m.lead?.avatarColor ?? null;
  const referredBy: string | null = m.referredBy?.name ?? null;
  const sectors: string[] = m.sector ?? [];

  const stageOptions = options("MandateStage");

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
          </div>
          {m.name && m.name !== clientName && (
            <p className="mt-1 text-sm text-zinc-500">{m.name}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" disabled>
            Export
          </Button>
        </div>
      </div>

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
            <RestageSelect
              kind="mandate"
              id={m.id}
              currentStage={m.stage}
              stageOptions={stageOptions}
            />
            <p className="mt-3 text-xs text-zinc-400">
              Changing stage immediately persists to the database and resets the stage timer.
            </p>
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

      <ActivityTimeline
        activities={(m.activities ?? []).map((a: { id: string; type: string; subject?: string | null; occurredAt: Date }): ActivityTimelineItem => ({
          id: a.id,
          type: a.type,
          subject: a.subject,
          occurredAt: a.occurredAt,
        }))}
      />
    </div>
  );
}
