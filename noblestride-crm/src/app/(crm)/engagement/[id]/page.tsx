// engagement/[id]/page.tsx — Engagement detail page.
// Server Component: single engagement with investor, transaction, and activity timeline.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getEngagement } from "@/server/services/engagements";
import { Chip, Card, CardHeader, CardBody, Avatar } from "@/components/ui";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import type { ActivityTimelineItem } from "@/components/crm/activity-timeline";
import { formatDate, daysAgoLabel } from "@/lib/format";

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

      {/* Activity timeline */}
      <ActivityTimeline activities={activityItems} />
    </div>
  );
}
