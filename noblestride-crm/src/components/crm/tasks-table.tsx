"use client";

// tasks-table.tsx — client-interactive task list: row click opens the edit
// drawer, a red "Overdue" chip surfaces `escalated` tasks, and each row has an
// inline delete. All Date values are pre-formatted by the server page before
// crossing into this client component.

import { useState } from "react";
import Link from "next/link";
import { label } from "@/lib/vocab";
import { cn } from "@/lib/cn";
import type { SelectOption } from "@/components/ui";
import { TaskFormDrawer } from "./task-form-drawer";
import { DeleteConfirm } from "./delete-confirm";

const STATUS_CHIP: Record<string, string> = {
  Ongoing: "bg-amber-50 text-amber-700",
  Pending: "bg-sky-50 text-sky-700",
  NotStarted: "bg-zinc-100 text-zinc-500",
  Done: "bg-emerald-50 text-emerald-700",
  Dropped: "bg-zinc-100 text-zinc-400 line-through",
};

const DELETE_TASK = `mutation DeleteTask($id: ID!) { deleteTask(id: $id) { id } }`;

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
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
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
            {tasks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-400">
                  No tasks yet. Use &ldquo;+ New Task&rdquo; to add one.
                </td>
              </tr>
            )}
            {tasks.map((t) => (
              <tr
                key={t.id}
                onClick={() => setEditing(t)}
                className="cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
              >
                <td className="max-w-md px-4 py-2.5">
                  <div className="font-medium text-zinc-900">{t.title}</div>
                  {t.body && <div className="truncate text-xs text-zinc-500">{t.body}</div>}
                </td>
                <td className="px-4 py-2.5">
                  {t.related ? (
                    <Link
                      href={t.related.href}
                      onClick={(e) => e.stopPropagation()}
                      className="text-emerald-700 hover:underline"
                    >
                      {t.related.name}
                    </Link>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_CHIP[t.status] ?? "bg-zinc-100 text-zinc-500",
                      )}
                    >
                      {label("TaskStatus", t.status)}
                    </span>
                    {t.escalated && (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                        Overdue
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-zinc-600">
                  {t.source ? label("TaskSource", t.source) : <span className="text-zinc-400">—</span>}
                </td>
                <td className="px-4 py-2.5 text-zinc-600">{t.assigneeName ?? "—"}</td>
                <td className="px-4 py-2.5 text-zinc-600">{t.dueAtDisplay}</td>
                <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <DeleteConfirm mutation={DELETE_TASK} recordId={t.id} entityLabel="task" redirectTo="/tasks" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
