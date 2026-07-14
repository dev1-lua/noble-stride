// DB-backed smoke test for actor-attribution threading (Task 4 of the
// crmAgent data-in feature): createTask/updateTask/logEngagement must stamp
// `createdSource` from the acting Actor (HUMAN/AGENT/API) rather than an
// unconditional "HUMAN" literal, so the upcoming agent-write registry (Task 5)
// can attribute writes correctly.
//
// Follows the project's `withDb` pattern: skips cleanly when DATABASE_URL is
// unset or the DB is unreachable.

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createTask, updateTask } from "@/server/services/tasks";
import { logEngagement } from "@/server/services/engagements";

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

async function withLinkedClient<T>(fn: (clientId: string) => Promise<T>): Promise<T> {
  const client = await prisma.client.create({ data: { name: "__task_attribution_smoke_client__" } });
  try {
    return await fn(client.id);
  } finally {
    await prisma.client.delete({ where: { id: client.id } });
  }
}

const AGENT_ACTOR = { type: "AGENT" as const, authenticated: true, delegated: true };

describe("createTask/updateTask actor attribution (smoke)", () => {
  it("stamps createdSource AGENT when created by an AGENT actor", async () => {
    const ran = await withDb(() =>
      withLinkedClient(async (clientId) => {
        const created = await createTask(
          { title: "ZZ Attribution Agent Task", status: "NotStarted", clientId },
          AGENT_ACTOR,
        );
        expect(created.createdSource).toBe("AGENT");
        await prisma.task.delete({ where: { id: created.id } });
      }),
    );
    void ran;
  });

  it("defaults createdSource to HUMAN when actor is omitted", async () => {
    const ran = await withDb(() =>
      withLinkedClient(async (clientId) => {
        const created = await createTask({ title: "ZZ Attribution Default Task", status: "NotStarted", clientId });
        expect(created.createdSource).toBe("HUMAN");
        await prisma.task.delete({ where: { id: created.id } });
      }),
    );
    void ran;
  });

  it("updateTask does not overwrite the original createdSource", async () => {
    const ran = await withDb(() =>
      withLinkedClient(async (clientId) => {
        const created = await createTask(
          { title: "ZZ Attribution Update Task", status: "NotStarted", clientId },
          AGENT_ACTOR,
        );
        expect(created.createdSource).toBe("AGENT");
        const updated = await updateTask(created.id, { status: "Ongoing" }, { type: "HUMAN" });
        expect(updated.createdSource).toBe("AGENT");
        await prisma.task.delete({ where: { id: created.id } });
      }),
    );
    void ran;
  });
});

describe("logEngagement actor attribution (smoke)", () => {
  it("stamps createdSource AGENT on both the created Engagement and Activity", async () => {
    const ran = await withDb(async () => {
      const txn = await prisma.transaction.findFirst({ select: { id: true } });
      if (txn == null) {
        console.log("No transaction in DB — skipping logEngagement attribution assertion");
        return null;
      }

      const investor = await prisma.investor.create({
        data: { name: "__attribution_smoke_investor__", investorType: "VentureCapital" },
      });

      try {
        const activity = await logEngagement(
          { transactionId: txn.id, investorId: investor.id, type: "Call" },
          AGENT_ACTOR,
        );
        expect(activity.createdSource).toBe("AGENT");

        const engagement = await prisma.engagement.findUnique({ where: { id: activity.engagementId! } });
        expect(engagement?.createdSource).toBe("AGENT");

        await prisma.activity.delete({ where: { id: activity.id } });
        await prisma.engagement.delete({ where: { id: activity.engagementId! } });
      } finally {
        await prisma.investor.delete({ where: { id: investor.id } });
      }
      return true;
    });
    void ran;
  });
});
