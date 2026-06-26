// DB-backed smoke test for the engagement CRUD partial-update merge.
// Follows the project's `withDb` pattern (see dashboard.smoke.test.ts): skips
// cleanly when DATABASE_URL is unset or the DB is unreachable.
//
// Focus: a single-field money update must NOT reset the other operand to null.
// We create an engagement with totalAmount=10, amountDisbursed=4 (pending=6),
// then update ONLY amountDisbursed=7 and assert pending recomputes to 3 against
// the PERSISTED total — not from the (otherwise-null) partial payload.

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createEngagement, updateEngagement } from "@/server/services/engagements-crud";

/** Run `fn`, skip on DB-connection errors, re-throw unexpected errors. */
async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set — skipping engagement merge smoke test");
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

describe("engagements-crud partial-update merge (smoke)", () => {
  it("recomputes amountPending against the persisted total when only amountDisbursed changes", async () => {
    const ran = await withDb(async () => {
      // Need a seeded transaction to satisfy the engagement FK; skip if none.
      // Transactions are never deleted by any test, so findFirst is stable.
      const txn = await prisma.transaction.findFirst({ select: { id: true } });
      if (txn == null) {
        console.log("No transaction in DB — skipping merge assertion");
        return null;
      }

      // Create a dedicated throwaway investor so this test is self-contained and
      // never races with investors-crud.smoke.test.ts deleting a transient investor.
      const inv = await prisma.investor.create({
        data: { name: "__merge_test_investor__", investorType: "VentureCapital" },
      });

      let created: Awaited<ReturnType<typeof createEngagement>> | null = null;
      try {
        created = await createEngagement(
          { transactionId: txn.id, investorId: inv.id, totalAmount: 10, amountDisbursed: 4 },
          { type: "HUMAN" },
        );
        expect(Number(created.totalAmount)).toBe(10);
        expect(Number(created.amountPending)).toBe(6);

        // Update ONLY amountDisbursed — total must be sourced from the persisted row.
        const updated = await updateEngagement(created.id, { amountDisbursed: 7 });
        expect(Number(updated.totalAmount)).toBe(10);
        expect(Number(updated.amountDisbursed)).toBe(7);
        expect(Number(updated.amountPending)).toBe(3);
      } finally {
        // Delete engagement first (FK), then the dedicated investor.
        if (created != null) {
          await prisma.engagement.delete({ where: { id: created.id } });
        }
        await prisma.investor.delete({ where: { id: inv.id } });
      }
      return true;
    });
    void ran; // assertions ran inside withDb when the DB was reachable
  });
});
