// DB-backed smoke test for the EngagementMilestone write path (spec §6.2).

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createClient, deleteClient } from "@/server/services/clients";
import { createTransaction, deleteTransaction } from "@/server/services/transactions";
import { createEngagement } from "@/server/services/engagements-crud";
import { recordMilestone, unrecordMilestone } from "@/server/services/milestones-crud";

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

describe("milestone record/unrecord (smoke)", () => {
  it("records (upsert), re-records with a new date, and unrecords a milestone", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__milestone_client__" }, { type: "HUMAN" });
      const txn = await createTransaction({ name: "__milestone_txn__", clientId: client.id }, { type: "HUMAN" });
      const investor = await prisma.investor.create({ data: { name: "__milestone_investor__", investorType: "DFI" } });
      let engagementId: string | null = null;
      try {
        const eng = await createEngagement({ transactionId: txn.id, investorId: investor.id }, { type: "HUMAN" });
        engagementId = eng.id;

        const rec = await recordMilestone({ engagementId: eng.id, key: "TeaserReview", notes: "reviewed" }, { type: "HUMAN" });
        expect(rec.key).toBe("TeaserReview");
        expect(rec.notes).toBe("reviewed");
        expect(rec.createdSource).toBe("HUMAN");

        // upsert: same key updates the date, no duplicate row
        const newDate = new Date("2026-01-15T00:00:00Z");
        const rec2 = await recordMilestone({ engagementId: eng.id, key: "TeaserReview", completedAt: newDate }, { type: "HUMAN" });
        expect(rec2.id).toBe(rec.id);
        expect(rec2.completedAt.getTime()).toBe(newDate.getTime());
        expect(await prisma.engagementMilestone.count({ where: { engagementId: eng.id } })).toBe(1);

        expect(await unrecordMilestone(eng.id, "TeaserReview")).toBe(true);
        expect(await prisma.engagementMilestone.count({ where: { engagementId: eng.id } })).toBe(0);
        // unrecording a missing row is a no-op, not an error
        expect(await unrecordMilestone(eng.id, "TeaserReview")).toBe(false);

        await expect(recordMilestone({ engagementId: "nope", key: "TeaserReview" }, { type: "HUMAN" })).rejects.toThrow(/not found/i);
      } finally {
        if (engagementId) {
          await prisma.engagementMilestone.deleteMany({ where: { engagementId } });
          await prisma.engagement.delete({ where: { id: engagementId } });
        }
        await prisma.investor.delete({ where: { id: investor.id } });
        await deleteTransaction(txn.id);
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });
});
