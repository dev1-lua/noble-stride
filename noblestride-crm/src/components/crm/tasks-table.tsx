"use client";

// tasks-table.tsx — client-interactive task list: row click opens the edit
// drawer, a red "Overdue" chip surfaces `escalated` tasks, and each row has an
// inline delete. All Date values are pre-formatted by the server page before
// crossing into this client component.

import { useState } from "react";
import Link from "next/link";
import { label, options } from "@/lib/vocab";
import { cn } from "@/lib/cn";
import type { SelectOption } from "@/components/ui";
import { TableSearch, type TableFilter } from "@/components/crm/table-search";
import { TaskFormDrawer } from "./task-form-drawer";
import { DeleteConfirm } from "./delete-confirm";

const STATUS_CHIP: Record<string, string> = {
  Ongoing: "bg-[var(--t-tag-bg-amber)] text-[var(--t-tag-text-amber)]",
  Pending: "bg-[var(--t-tag-bg-sky)] text-[var(--t-tag-text-sky)]",
  NotStarted: "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]",
  Done: "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]",
  Dropped: "bg-[var(--t-tag-bg-gray)] text-[var(--text-tertiary)] line-through",
};

const DELETE_TASK = `mutation DeleteTask($id: ID!) { deleteTask(id: $id) { id } }`;

const taskFilters: TableFilter<TaskRowData>[] = [
  { key: "status", label: "Status", options: options("TaskStatus"), get: (row) => row.status },
];

export interface TaskRowData {
  id: string;
  title: string;
  status: string;
  source: string | null;
  escalated: boolean;
  dueAtDisplay: string;
  dueAtInput: string;
  body: string | null;
  assigneeName: string | null;
  assigneeId: string | null;
  assistantId: string | null;
  mandateId: string | null;
  transactionId: string | null;
  investorId: string | null;
  clientId: string | null;
  related: { href: string; name: string } | null;
}

export function TasksTable({ tasks, mandates, transactions, investors, clients, users }: {
  tasks: TaskRowData[];
  mandates: SelectOption[];
  transactions: SelectOption[];
  investors: SelectOption[];
  clients: SelectOption[];
  users: SelectOption[];
}) {
  const [editing, setEditing] = useState<TaskRowData | null>(null);

  return (
    <>
      <TableSearch
        rows={tasks}
        searchText={(t) => [t.title, t.body ?? "", t.related?.name ?? ""]}
        filters={taskFilters}
        searchPlaceholder="Search tasks…"
        emptyLabel="No tasks yet. Use “+ New Task” to add one."
      >
        {(filtered) => (
          <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                  <th className="px-4 py-3">Action point</th>
                  <th className="px-4 py-3">Related to</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Deadline</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setEditing(t)}
                    className="cursor-pointer border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-secondary)]"
                  >
                    <td className="max-w-md px-4 py-2.5">
                      <div className="font-medium text-[var(--text-primary)]">{t.title}</div>
                      {t.body && <div className="truncate text-xs text-[var(--text-tertiary)]">{t.body}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.related ? (
                        <Link
                          href={t.related.href}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[var(--accent)] hover:underline"
                        >
                          {t.related.name}
                        </Link>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            STATUS_CHIP[t.status] ?? "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]",
                          )}
                        >
                          {label("TaskStatus", t.status)}
                        </span>
                        {t.escalated && (
                          <span className="rounded-full bg-[var(--t-tag-bg-rose)] px-2 py-0.5 text-xs font-medium text-[var(--t-tag-text-rose)]">
                            Overdue
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                      {t.source ? label("TaskSource", t.source) : <span className="text-[var(--text-tertiary)]">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{t.assigneeName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{t.dueAtDisplay}</td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <DeleteConfirm mutation={DELETE_TASK} recordId={t.id} entityLabel="task" redirectTo="/tasks" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableSearch>

      {editing && (
        <TaskFormDrawer
          mode="edit"
          initial={{
            id: editing.id,
            title: editing.title,
            status: editing.status,
            source: editing.source ?? "",
            dueAt: editing.dueAtInput,
            body: editing.body ?? "",
            assigneeId: editing.assigneeId ?? "",
            assistantId: editing.assistantId ?? "",
            mandateId: editing.mandateId ?? "",
            transactionId: editing.transactionId ?? "",
            investorId: editing.investorId ?? "",
            clientId: editing.clientId ?? "",
          }}
          mandates={mandates}
          transactions={transactions}
          investors={investors}
          clients={clients}
          users={users}
          open
          onOpenChange={(next) => { if (!next) setEditing(null); }}
        />
      )}
    </>
  );
}
