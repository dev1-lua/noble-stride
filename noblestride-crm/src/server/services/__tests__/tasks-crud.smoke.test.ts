// DB-backed smoke test for Task CRUD + overdue escalation (spec §3.8/§12.2).
// Follows the project's `withDb` pattern: skips cleanly when DATABASE_URL is
// unset or the DB is unreachable.

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createTask, updateTask, deleteTask, flagOverdueTasks } from "@/server/services/tasks";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await fn();
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

// BUG-10 (spec §3.8): taskCreateSchema now requires a linked record, so every
// createTask() call in this file needs a real FK target. We create a
// dedicated throwaway Client per test (self-contained, no races with other
// smoke tests) and clean it up in `finally`, same convention as
// engagements-crud.smoke.test.ts's throwaway investor.
async function withLinkedClient<T>(fn: (clientId: string) => Promise<T>): Promise<T> {
  const client = await prisma.client.create({ data: { name: "__task_smoke_client__" } });
  try {
    return await fn(client.id);
  } finally {
    await prisma.client.delete({ where: { id: client.id } });
  }
}

describe("task CRUD (smoke)", () => {
  it("creates, updates, and deletes a task", async () => {
    const out = await withDb(() =>
      withLinkedClient(async (clientId) => {
        const created = await createTask({ title: "ZZ Test Task", status: "NotStarted", source: "WhatsApp", clientId });
        expect(created.title).toBe("ZZ Test Task");
        expect(created.status).toBe("NotStarted");
        expect(created.source).toBe("WhatsApp");
        expect(created.escalated).toBe(false);

        const updated = await updateTask(created.id, { status: "Ongoing", body: "in progress" });
        expect(updated.status).toBe("Ongoing");
        expect(updated.body).toBe("in progress");

        await deleteTask(created.id);
        const gone = await prisma.task.findUnique({ where: { id: created.id } });
        expect(gone).toBeNull();
        return true;
      }),
    );
    if (out === null) return;
  });
});

describe("updateTask escalated recompute (smoke)", () => {
  it("clears escalated when an overdue open task is marked Done", async () => {
    const out = await withDb(() =>
      withLinkedClient(async (clientId) => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const created = await createTask({ title: "ZZ Escalated->Done", status: "Pending", dueAt: yesterday, clientId });
        try {
          await flagOverdueTasks();
          const flagged = await prisma.task.findUniqueOrThrow({ where: { id: created.id } });
          expect(flagged.escalated).toBe(true);

          const done = await updateTask(created.id, { status: "Done" });
          expect(done.status).toBe("Done");
          expect(done.escalated).toBe(false);
        } finally {
          await prisma.task.delete({ where: { id: created.id } });
        }
        return true;
      }),
    );
    if (out === null) return;
  });

  it("re-flags escalated when a Done task with a past dueAt is reopened", async () => {
    const out = await withDb(() =>
      withLinkedClient(async (clientId) => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const created = await createTask({ title: "ZZ Reopen->Escalated", status: "Done", dueAt: yesterday, clientId });
        expect(created.escalated).toBe(false);
        try {
          const reopened = await updateTask(created.id, { status: "Pending" });
          expect(reopened.status).toBe("Pending");
          expect(reopened.escalated).toBe(true);
        } finally {
          await prisma.task.delete({ where: { id: created.id } });
        }
        return true;
      }),
    );
    if (out === null) return;
  });

  it("clears escalated immediately when dueAt is moved into the future", async () => {
    const out = await withDb(() =>
      withLinkedClient(async (clientId) => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const created = await createTask({ title: "ZZ DueAt->Future", status: "Ongoing", dueAt: yesterday, clientId });
        try {
          await flagOverdueTasks();
          const flagged = await prisma.task.findUniqueOrThrow({ where: { id: created.id } });
          expect(flagged.escalated).toBe(true);

          const pushed = await updateTask(created.id, { dueAt: tomorrow });
          expect(pushed.dueAt?.getTime()).toBe(tomorrow.getTime());
          expect(pushed.escalated).toBe(false);
        } finally {
          await prisma.task.delete({ where: { id: created.id } });
        }
        return true;
      }),
    );
    if (out === null) return;
  });

  it("ignores a caller-supplied `escalated` value on create and update — it is computed only", async () => {
    const out = await withDb(() =>
      withLinkedClient(async (clientId) => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        // Caller tries to force escalated: true on a non-overdue task at create time.
        const created = await createTask({
          title: "ZZ Caller Escalated Ignored",
          status: "NotStarted",
          dueAt: tomorrow,
          clientId,
          ...({ escalated: true } as Record<string, unknown>),
        } as never);
        expect(created.escalated).toBe(false);

        try {
          // Caller tries again on update, without touching status/dueAt — should stay untouched.
          const updated = await updateTask(created.id, {
            body: "note",
            ...({ escalated: true } as Record<string, unknown>),
          } as never);
          expect(updated.escalated).toBe(false);

          // Caller tries once more, this time alongside a status change that would
          // legitimately keep escalated false (task stays open but not overdue) —
          // the caller's `true` must still be ignored in favor of the computed value.
          const updated2 = await updateTask(created.id, {
            status: "Ongoing",
            ...({ escalated: true } as Record<string, unknown>),
          } as never);
          expect(updated2.status).toBe("Ongoing");
          expect(updated2.escalated).toBe(false);
        } finally {
          await prisma.task.delete({ where: { id: created.id } });
        }
        return true;
      }),
    );
    if (out === null) return;
  });
});

describe("flagOverdueTasks (smoke)", () => {
  it("flips only open tasks past their deadline — leaves Done and future-dated tasks alone", async () => {
    const out = await withDb(() =>
      withLinkedClient(async (clientId) => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const overdueOpen = await createTask({ title: "ZZ Overdue Open", status: "Pending", dueAt: yesterday, clientId });
        const overdueDone = await createTask({ title: "ZZ Overdue Done", status: "Done", dueAt: yesterday, clientId });
        const futureOpen = await createTask({ title: "ZZ Future Open", status: "Ongoing", dueAt: tomorrow, clientId });
        const overdueDropped = await createTask({ title: "ZZ Overdue Dropped", status: "Dropped", dueAt: yesterday, clientId });

        try {
          const flipped = await flagOverdueTasks(now);
          expect(flipped).toBeGreaterThanOrEqual(1);

          const [refreshedOpen, refreshedDone, refreshedFuture, refreshedDropped] = await Promise.all([
            prisma.task.findUniqueOrThrow({ where: { id: overdueOpen.id } }),
            prisma.task.findUniqueOrThrow({ where: { id: overdueDone.id } }),
            prisma.task.findUniqueOrThrow({ where: { id: futureOpen.id } }),
            prisma.task.findUniqueOrThrow({ where: { id: overdueDropped.id } }),
          ]);

          expect(refreshedOpen.escalated).toBe(true);
          expect(refreshedDone.escalated).toBe(false);
          expect(refreshedFuture.escalated).toBe(false);
          expect(refreshedDropped.escalated).toBe(false);

          // Idempotent: a second pass over the same rows flips nothing new.
          const secondPass = await flagOverdueTasks(now);
          expect(secondPass).toBe(0);
        } finally {
          await prisma.task.deleteMany({
            where: { id: { in: [overdueOpen.id, overdueDone.id, futureOpen.id, overdueDropped.id] } },
          });
        }
        return true;
      }),
    );
    if (out === null) return;
  });
});
