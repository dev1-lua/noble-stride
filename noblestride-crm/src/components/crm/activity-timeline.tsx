// activity-timeline.tsx — Shared server component for rendering activity lists.
// Server Component: no "use client". Receives pre-mapped ActivityTimelineItem[].

import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { label } from "@/lib/vocab";
import { daysAgoLabel } from "@/lib/format";
import { TaskFormDrawer } from "@/components/crm/task-form-drawer";

export interface ActivityTimelineItem {
  id: string;
  type: string;            // InteractionType enum value
  subject?: string | null;
  /** Free-text detail, e.g. the message an investor typed with an EOI. */
  body?: string | null;
  occurredAt: Date;
  context?: string | null; // optional secondary line e.g. "Akili Kids · Acme Capital"
  channel?: string | null; // CommChannel enum value (spec §3.10)
  direction?: string | null; // CommDirection enum value (spec §3.10)
  /** Record links copied onto tasks created from this activity (spec §3.10). */
  links?: { clientId?: string | null; mandateId?: string | null; transactionId?: string | null; investorId?: string | null };
  /** Tasks already extracted from this activity. */
  tasks?: { id: string; title: string; status: string }[];
}

export interface ActivityTaskOptions {
  mandates: SelectOption[];
  transactions: SelectOption[];
  investors: SelectOption[];
  clients: SelectOption[];
  users: SelectOption[];
}

export function ActivityTimeline({
  activities,
  title = "Recent Activity",
  emptyText = "No activity recorded.",
  taskOptions,
}: {
  activities: ActivityTimelineItem[];
  title?: string;
  emptyText?: string;
  taskOptions?: ActivityTaskOptions;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      </CardHeader>
      <CardBody>
        {activities.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">{emptyText}</p>
        ) : (
          <ul className="space-y-3">
            {activities.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-accent flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      {label("InteractionType", a.type)}
                    </span>
                    {a.channel && (
                      <span className="rounded-full bg-[var(--t-tag-bg-gray)] px-2 py-0.5 text-[11px] font-medium text-[var(--t-tag-text-gray)]">
                        {label("CommChannel", a.channel)}
                      </span>
                    )}
                    {a.direction && (
                      <span className="rounded-full bg-[var(--t-tag-bg-gray)] px-2 py-0.5 text-[11px] font-medium text-[var(--t-tag-text-gray)]">
                        {label("CommDirection", a.direction)}
                      </span>
                    )}
                    {a.subject && (
                      <span className="text-sm text-[var(--text-primary)] truncate">{a.subject}</span>
                    )}
                  </div>
                  {a.body && (
                    <p className="mt-0.5 text-sm text-[var(--text-secondary)] whitespace-pre-line line-clamp-3">
                      {a.body}
                    </p>
                  )}
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{daysAgoLabel(a.occurredAt)}</p>
                  {(a.tasks ?? []).length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {a.tasks!.map((task) => (
                        <li key={task.id} className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--border-strong)]" />
                          <Link href="/tasks" className="hover:text-accent transition-colors">{task.title}</Link>
                          <span className="text-[var(--text-tertiary)]">· {label("TaskStatus", task.status)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {taskOptions && (
                    <div className="mt-1.5">
                      <TaskFormDrawer
                        mode="create"
                        triggerLabel="+ Task"
                        initial={{
                          title: a.subject ?? label("InteractionType", a.type),
                          activityId: a.id,
                          clientId: a.links?.clientId ?? "",
                          mandateId: a.links?.mandateId ?? "",
                          transactionId: a.links?.transactionId ?? "",
                          investorId: a.links?.investorId ?? "",
                        }}
                        mandates={taskOptions.mandates}
                        transactions={taskOptions.transactions}
                        investors={taskOptions.investors}
                        clients={taskOptions.clients}
                        users={taskOptions.users}
                      />
                    </div>
                  )}
                  {a.context && (
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{a.context}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
