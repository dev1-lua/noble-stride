// engagement/page.tsx — Engagement tracker.
// Server Component: counters + per-deal grouped engagements + activity timeline.
// LogEngagementDialog is the only client component here (receives plain SelectOption[]).

import { engagementsByDeal } from "@/server/services/engagements";
import { engagementCounters, activityTimeline } from "@/server/services/activities";
import { listTransactions } from "@/server/services/transactions";
import { listInvestors } from "@/server/services/investors";
import { StatCard, Chip, Card, CardHeader, CardBody, Badge } from "@/components/ui";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import type { ActivityTimelineItem } from "@/components/crm/activity-timeline";
import { LogEngagementDialog } from "@/components/crm/log-engagement-dialog";

export default async function EngagementPage() {
  // Parallel fetches
  const [counters, deals, timeline, transactions, investors] = await Promise.all([
    engagementCounters(),
    engagementsByDeal(),
    activityTimeline(),
    listTransactions(),
    listInvestors({}),
  ]);

  // Build SelectOption[] for dialog (plain strings — safe to pass to client component)
  const txnOptions = transactions.map((t) => ({ value: t.id, label: t.name }));
  const invOptions = investors.map((i) => ({ value: i.id, label: i.name }));

  // Map timeline activities to ActivityTimelineItem
  const timelineItems: ActivityTimelineItem[] = timeline.map((a) => ({
    id: a.id,
    type: a.type,
    subject: a.subject,
    occurredAt: a.occurredAt,
    context: [a.investor?.name, a.transaction?.name].filter(Boolean).join(" · ") || null,
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

      {/* Counters strip — 6 tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Outreach" value={String(counters.outreach)} />
        <StatCard label="NDA Signed" value={String(counters.ndaSigned)} />
        <StatCard label="Data Room" value={String(counters.dataRoom)} />
        <StatCard label="Meetings" value={String(counters.meetings)} />
        <StatCard label="Feedback" value={String(counters.feedback)} />
        <StatCard label="Term Sheets" value={String(counters.termSheets)} />
      </div>

      {/* Main content: per-deal list + activity timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: per-deal grouped engagements */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">
            By Deal
          </h2>
          {deals.length === 0 ? (
            <Card>
              <CardBody>
                <p className="text-sm text-zinc-400">No engagements recorded yet.</p>
              </CardBody>
            </Card>
          ) : (
            deals.map(({ transaction, engagements }) => (
              <Card key={transaction.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-zinc-900 truncate">
                        {transaction.name}
                      </h3>
                      {transaction.client?.name && (
                        <p className="text-xs text-zinc-500 mt-0.5">{transaction.client.name}</p>
                      )}
                    </div>
                    <Badge tone="neutral">{engagements.length}</Badge>
                  </div>
                </CardHeader>
                <CardBody>
                  <ul className="divide-y divide-zinc-100">
                    {engagements.map((eng) => (
                      <li key={eng.id} className="py-2.5 flex items-center justify-between gap-3">
                        <span className="text-sm text-zinc-900 truncate">
                          {eng.investor.name}
                        </span>
                        <Chip value={eng.status} group="EngagementStatus" />
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            ))
          )}
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
