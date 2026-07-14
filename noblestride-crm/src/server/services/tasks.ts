// Task service — single source of truth over Prisma for the lightweight
// task/action-point tracker (spec §3.8/§3.10). No GraphQL, no React.
//
// `actor` is optional on both create/update — omitted calls keep the prior
// behavior (createdSource defaults to HUMAN). updateTask accepts the param
// for registry uniformity (Task 5) but must never overwrite createdSource.

import { prisma } from "@/lib/db";
import type { TaskStatus } from "@prisma/client";
import type { Actor } from "@/graphql/context";
import { actorSource } from "./crud";
import { taskCreateSchema, taskUpdateSchema, type TaskCreateInput, type TaskUpdateInput } from "@/lib/schemas/task";
import { notify } from "./notifications";

/** Statuses that count as "still open" for overdue escalation (spec §12.2). */
const OPEN_STATUSES: TaskStatus[] = ["NotStarted", "Pending", "Ongoing"];

// ─── CRUD operations ──────────────────────────────────────────────────────────

export async function createTask(input: TaskCreateInput, actor?: Actor) {
  const data = taskCreateSchema.parse(input);
  return prisma.task.create({ data: { ...data, createdSource: actorSource(actor ?? { type: "HUMAN" }) } });
}

/**
 * Update a task, recomputing `escalated` (spec §3.8 — Auto, never
 * caller-settable) whenever `status` and/or `dueAt` are part of the update.
 * A task that is open (NotStarted/Pending/Ongoing) AND overdue is flagged
 * immediately — e.g. pushing dueAt into the past, or reopening a Done task
 * that already has a past dueAt — rather than waiting for the next
 * `flagOverdueTasks()` sweep. A task that leaves an open status, or whose
 * dueAt is cleared/moved to the future, is un-flagged in the same update.
 */
export async function updateTask(id: string, input: TaskUpdateInput, _actor?: Actor) {
  const data = taskUpdateSchema.parse(input);

  let escalated: boolean | undefined;
  if ("status" in data || "dueAt" in data) {
    const current = await prisma.task.findUniqueOrThrow({
      where: { id },
      select: { status: true, dueAt: true },
    });
    const status = "status" in data && data.status ? data.status : current.status;
    const dueAt = "dueAt" in data ? (data.dueAt ?? null) : current.dueAt;
    const isOpen = OPEN_STATUSES.includes(status);
    const isOverdue = dueAt != null && dueAt.getTime() < Date.now();
    escalated = isOpen && isOverdue;
  }

  return prisma.task.update({
    where: { id },
    data: escalated === undefined ? data : { ...data, escalated },
  });
}

export async function deleteTask(id: string) {
  return prisma.task.delete({ where: { id } });
}

// ─── Overdue escalation (spec §3.8/§12.2 — Auto) ──────────────────────────────

/**
 * Flip `escalated = true` on every task whose deadline has passed while it is
 * still open (status in NotStarted/Pending/Ongoing). Done/Dropped tasks and
 * tasks with a future (or no) dueAt are left untouched.
 *
 * Idempotent: only rows currently `escalated: false` are matched, so calling
 * this repeatedly (e.g. once per tasks-page load) is a cheap no-op once a
 * task has already been flagged. Returns the number of rows flipped.
 *
 * Notifies each task's assignee exactly once, on the false→true transition:
 * the about-to-flip rows are read BEFORE the `updateMany` (which itself
 * cannot return per-row data), then notified after the update commits.
 */
export async function flagOverdueTasks(now: Date = new Date()): Promise<number> {
  const toEscalate = await prisma.task.findMany({
    where: {
      dueAt: { lt: now },
      status: { in: OPEN_STATUSES },
      escalated: false,
    },
    select: { id: true, title: true, assigneeId: true },
  });
  if (toEscalate.length === 0) return 0;

  const result = await prisma.task.updateMany({
    where: { id: { in: toEscalate.map((t) => t.id) } },
    data: { escalated: true },
  });

  for (const task of toEscalate) {
    await notify([task.assigneeId], {
      kind: "task_overdue",
      title: `Overdue: ${task.title}`,
      href: "/tasks",
    });
  }

  return result.count;
}
