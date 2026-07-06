// DB-backed smoke test for generalized communication logging (spec §3.10):
// logActivity + the createdById fix on logEngagement.
// Follows the project's `withDb` pattern: skips cleanly when DATABASE_URL is
// unset or the DB is unreachable. Each case creates its own rows and cleans
// up in a `finally` block, per project convention (fileParallelism:false).

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { CrudError } from "@/server/services/crud";
import { createClient, deleteClient } from "@/server/services/clients";
import { createTransaction, deleteTransaction } from "@/server/services/transactions";
import { logActivity, logEngagement } from "@/server/services/engagements";

/** Run `fn`, skip on DB-connection errors, re-throw unexpected errors. */
async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set — skipping log-activity smoke test");
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

describe("logActivity — generalized communication logging (smoke)", () => {
  it("logs against a client alone (no mandate/transaction/investor/engagement)", async () => {
    const ran = await withDb(async () => {
      const client = await createClient({ name: "__log_activity_client__" }, { type: "HUMAN" });
      try {
        const activity = await logActivity(
          { type: "Outreach", subject: "Bare-client outreach", channel: "WhatsApp", direction: "Inbound", body: "Bare-client note", clientId: client.id },
          { type: "HUMAN" },
        );
        expect(activity.clientId).toBe(client.id);
        expect(activity.mandateId).toBeNull();
        expect(activity.transactionId).toBeNull();
        expect(activity.investorId).toBeNull();
        expect(activity.engagementId).toBeNull();
        expect(activity.channel).toBe("WhatsApp");
        expect(activity.direction).toBe("Inbound");
      } finally {
        await prisma.activity.deleteMany({ where: { clientId: client.id } });
        await deleteClient(client.id);
      }
      return true;
    });
    void ran;
  });

  it("rejects logging with no linked record at all", async () => {
    const ran = await withDb(async () => {
      await expect(logActivity({ type: "Outreach", subject: "Note" }, { type: "HUMAN" })).rejects.toThrow(CrudError);
      return true;
    });
    void ran;
  });

  it("rejects logActivity without a subject (spec §3.10 summary required)", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__log_subject_client__" }, { type: "HUMAN" });
      try {
        await expect(
          logActivity({ type: "Note", clientId: client.id } as never, { type: "HUMAN" }),
        ).rejects.toThrow();
      } finally {
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });

  it("populates createdById from the acting user when present", async () => {
    const ran = await withDb(async () => {
      const user = await prisma.user.findFirst({ select: { id: true } });
      if (user == null) {
        console.log("No seeded user in DB — skipping createdById assertion");
        return null;
      }
      const client = await createClient({ name: "__log_activity_createdby_client__" }, { type: "HUMAN" });
      try {
        const activity = await logActivity(
          { type: "Meeting", subject: "Kickoff meeting", clientId: client.id },
          { type: "HUMAN", userId: user.id },
        );
        expect(activity.createdById).toBe(user.id);
      } finally {
        await prisma.activity.deleteMany({ where: { clientId: client.id } });
        await deleteClient(client.id);
      }
      return true;
    });
    void ran;
  });
});

describe("logEngagement — backward compatibility (smoke)", () => {
  it("still logs against a transaction+investor pair and upserts the Engagement", async () => {
    const ran = await withDb(async () => {
      const client = await createClient({ name: "__log_engagement_client__" }, { type: "HUMAN" });
      const txn = await createTransaction({ name: "__log_engagement_txn__", clientId: client.id }, { type: "HUMAN" });
      const investor = await prisma.investor.create({
        data: { name: "__log_engagement_investor__", investorType: "VentureCapital" },
      });
      const user = await prisma.user.findFirst({ select: { id: true } });

      let engagementId: string | null = null;
      try {
        const activity = await logEngagement(
          { transactionId: txn.id, investorId: investor.id, type: "Meeting", subject: "Kickoff call" },
          user != null ? { type: "HUMAN", userId: user.id } : { type: "HUMAN" },
        );
        expect(activity.transactionId).toBe(txn.id);
        expect(activity.investorId).toBe(investor.id);
        expect(activity.engagementId).not.toBeNull();
        engagementId = activity.engagementId;

        if (user != null) {
          expect(activity.createdById).toBe(user.id);
        }

        const engagement = await prisma.engagement.findUniqueOrThrow({ where: { id: engagementId! } });
        expect(engagement.transactionId).toBe(txn.id);
        expect(engagement.investorId).toBe(investor.id);
        expect(engagement.status).toBe("Contacted");
      } finally {
        if (engagementId != null) {
          await prisma.activity.deleteMany({ where: { engagementId } });
          await prisma.engagement.delete({ where: { id: engagementId } });
        }
        await prisma.investor.delete({ where: { id: investor.id } });
        await deleteTransaction(txn.id);
        await deleteClient(client.id);
      }
      return true;
    });
    void ran;
  });
});
