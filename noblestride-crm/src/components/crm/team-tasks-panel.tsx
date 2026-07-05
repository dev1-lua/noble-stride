// team-tasks-panel.tsx — Dashboard "Team & Tasks" section (spec §13):
// deal load by team member, task-status-by-owner cross-tab, and the overdue
// actions list. Presentational, server-safe (no "use client").

import Link from "next/link";
import { LABELS, label } from "@/lib/vocab";
import { formatDate } from "@/lib/format";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui";
import type { TeamWorkload, TaskStatusByOwner, OverdueTaskItem } from "@/server/services/dashboard";

const TASK_STATUSES = Object.keys(LABELS.TaskStatus);

// ─── Deal load by team member ──────────────────────────────────────────────────

export function TeamWorkloadTable({ rows }: { rows: TeamWorkload[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-zinc-400">No open mandates or active transactions assigned yet.</p>;
  }
  return (
    <Table>
      <THead>
        <Tr className="hover:bg-transparent">
          <Th>Team Member</Th>
          <Th className="text-right">Open Mandates</Th>
          <Th className="text-right">Active Transactions</Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map((r) => (
          <Tr key={r.userId}>
            <Td className="font-medium text-zinc-900">{r.name}</Td>
            <Td className="text-right tabular-nums">{r.openMandates}</Td>
            <Td className="text-right tabular-nums">{r.activeTransactions}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

// ─── Task status × owner cross-tab ──────────────────────────────────────────────

export function TaskStatusCrosstab({ rows }: { rows: TaskStatusByOwner[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-zinc-400">No tasks assigned yet.</p>;
  }
  return (
    <Table>
      <THead>
        <Tr className="hover:bg-transparent">
          <Th>Team Member</Th>
          {TASK_STATUSES.map((s) => (
            <Th key={s} className="text-right">
              {label("TaskStatus", s)}
            </Th>
          ))}
        </Tr>
      </THead>
      <TBody>
        {rows.map((r) => (
          <Tr key={r.userId}>
            <Td className="font-medium text-zinc-900">{r.name}</Td>
            {TASK_STATUSES.map((s) => (
              <Td key={s} className="text-right tabular-nums">
                {r.counts[s] ?? 0}
              </Td>
            ))}
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

// ─── Overdue actions ────────────────────────────────────────────────────────────

export function OverdueActionsList({ count, items }: { count: number; items: OverdueTaskItem[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-bold tabular-nums text-rose-700">{count}</span>
        <Link href="/tasks" className="text-xs font-medium text-accent hover:underline">
          View all tasks
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-400">No overdue action points.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-md bg-rose-50 px-2.5 py-1.5"
            >
              <span className="truncate text-xs font-medium text-zinc-800" title={t.title}>
                {t.title}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-[11px] text-rose-600">
                {t.assigneeName && <span>{t.assigneeName}</span>}
                <span>{formatDate(t.dueAt) || "no due date"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
