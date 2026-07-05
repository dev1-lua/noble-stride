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

describe("task CRUD (smoke)", () => {
  it("creates, updates, and deletes a task", async () => {
    const out = await withDb(async () => {
      const created = await createTask({ title: "ZZ Test Task", status: "NotStarted", source: "WhatsApp" });
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
    });
    if (out === null) return;
  });
});

describe("flagOverdueTasks (smoke)", () => {
  it("flips only open tasks past their deadline — leaves Done and future-dated tasks alone", async () => {
    const out = await withDb(async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const overdueOpen = await createTask({ title: "ZZ Overdue Open", status: "Pending", dueAt: yesterday });
      const overdueDone = await createTask({ title: "ZZ Overdue Done", status: "Done", dueAt: yesterday });
      const futureOpen = await createTask({ title: "ZZ Future Open", status: "Ongoing", dueAt: tomorrow });
      const overdueDropped = await createTask({ title: "ZZ Overdue Dropped", status: "Dropped", dueAt: yesterday });

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
    });
    if (out === null) return;
  });
});
