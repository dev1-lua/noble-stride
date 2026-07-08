// DB-backed smoke tests for the notification service (Task 14) and its
// mandate-stage-change emission point. Follows the project's `withDb`
// pattern: skips cleanly when DATABASE_URL is unset or the DB is
// unreachable. Each case creates its own rows and cleans up in a `finally`
// block, per project convention (fileParallelism:false).

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { notify, unreadFor } from "@/server/services/notifications";
import { createClient, deleteClient } from "@/server/services/clients";
import { createMandate, deleteMandate, setMandateStage } from "@/server/services/mandates";

/** Run `fn`, skip on DB-connection errors, re-throw unexpected errors. */
async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set — skipping notifications smoke test");
    return null;
  }
  try {
    return await fn();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("connect") ||
      message.includes("Can't reach database") ||
      message.includes("P1001") ||
      message.includes("P1002")
    ) {
      console.log("DB unreachable — skipping smoke test:", message);
      return null;
    }
    throw err;
  }
}

async function makeUser(suffix: string) {
  return prisma.user.create({
    data: { name: `__notif_user_${suffix}__`, email: `__notif_user_${suffix}__@example.test` },
  });
}

describe("notify (smoke)", () => {
  it("dedupes recipients and creates one row per unique userId", async () => {
    const ran = await withDb(async () => {
      const user = await makeUser("dedupe");
      try {
        await notify([user.id, user.id, user.id], { kind: "task_overdue", title: "Dedupe test" });
        const rows = await prisma.notification.findMany({ where: { userId: user.id, title: "Dedupe test" } });
        expect(rows).toHaveLength(1);
      } finally {
        await prisma.notification.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
      return true;
    });
    void ran;
  });

  it("no-ops silently on empty/falsy recipients (no row created, no throw)", async () => {
    const ran = await withDb(async () => {
      await expect(
        notify([null, undefined, ""] as unknown as string[], { kind: "task_overdue", title: "Should never persist" }),
      ).resolves.toBeUndefined();
      const rows = await prisma.notification.findMany({ where: { title: "Should never persist" } });
      expect(rows).toHaveLength(0);
      return true;
    });
    void ran;
  });
});

describe("unreadFor (smoke)", () => {
  it("returns only unread notifications, newest first, limited", async () => {
    const ran = await withDb(async () => {
      const user = await makeUser("unread");
      try {
        const older = await prisma.notification.create({
          data: { userId: user.id, kind: "task_overdue", title: "Older unread" },
        });
        // Backdate so ordering is deterministic regardless of clock resolution.
        await prisma.notification.update({
          where: { id: older.id },
          data: { createdAt: new Date(Date.now() - 60_000) },
        });
        await prisma.notification.create({
          data: { userId: user.id, kind: "task_overdue", title: "Newer unread" },
        });
        await prisma.notification.create({
          data: { userId: user.id, kind: "task_overdue", title: "Already read", readAt: new Date() },
        });

        const unread = await unreadFor(user.id, 15);
        expect(unread.map((n) => n.title)).toEqual(["Newer unread", "Older unread"]);

        const limited = await unreadFor(user.id, 1);
        expect(limited).toHaveLength(1);
        expect(limited[0].title).toBe("Newer unread");
      } finally {
        await prisma.notification.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
      return true;
    });
    void ran;
  });
});

describe("mandate stage-change notification emission (smoke)", () => {
  it("notifies the lead on restage but not when the lead is the acting user", async () => {
    const ran = await withDb(async () => {
      const lead = await makeUser("lead");
      const otherActor = await makeUser("actor");
      const client = await createClient({ name: "__notif_mandate_client__" }, { type: "HUMAN" });
      const mandate = await createMandate(
        { name: "__notif_mandate__", clientId: client.id, leadId: lead.id } as never,
        { type: "HUMAN" },
      );
      try {
        // A different actor moves the stage — the lead should be notified.
        await setMandateStage(mandate.id, "Qualification", { type: "HUMAN", userId: otherActor.id });
        const leadNotifications = await prisma.notification.findMany({ where: { userId: lead.id } });
        expect(leadNotifications).toHaveLength(1);
        expect(leadNotifications[0].kind).toBe("stage_change");
        expect(leadNotifications[0].title).toBe("__notif_mandate__: New Lead → Qualification");
        expect(leadNotifications[0].href).toBe(`/mandates/${mandate.id}`);

        // The lead itself moves the stage — must NOT self-notify.
        await setMandateStage(mandate.id, "PitchPresentation", { type: "HUMAN", userId: lead.id });
        const afterSelfChange = await prisma.notification.findMany({ where: { userId: lead.id } });
        expect(afterSelfChange).toHaveLength(1); // unchanged — no new row for the self-triggered restage
      } finally {
        await prisma.stageChange.deleteMany({ where: { mandateId: mandate.id } });
        await prisma.notification.deleteMany({ where: { userId: { in: [lead.id, otherActor.id] } } });
        await deleteMandate(mandate.id);
        await deleteClient(client.id);
        await prisma.user.delete({ where: { id: lead.id } });
        await prisma.user.delete({ where: { id: otherActor.id } });
      }
      return true;
    });
    void ran;
  });
});
