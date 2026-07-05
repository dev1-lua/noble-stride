// DB-backed smoke test for the StageChange write path (SPEC §7.1).
// Follows the project's `withDb` pattern: skips cleanly when DATABASE_URL is
// unset or the DB is unreachable. Each case creates its own rows and cleans
// up in a `finally` block, per project convention (fileParallelism:false).

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createClient, deleteClient } from "@/server/services/clients";
import { createMandate, deleteMandate, setMandateStage, updateMandate } from "@/server/services/mandates";
import { createTransaction, deleteTransaction, setTransactionStage, updateTransaction } from "@/server/services/transactions";
import { createEngagement, updateEngagement } from "@/server/services/engagements-crud";

/** Run `fn`, skip on DB-connection errors, re-throw unexpected errors. */
async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set — skipping stage-history smoke test");
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

describe("stage-history write path (smoke)", () => {
  it("records a StageChange row when a mandate restages", async () => {
    const ran = await withDb(async () => {
      const client = await createClient({ name: "__stage_history_mandate_client__" }, { type: "HUMAN" });
      const mandate = await createMandate({ name: "__stage_history_mandate__", clientId: client.id }, { type: "HUMAN" });
      try {
        expect(mandate.stage).toBe("NewLead");

        await setMandateStage(mandate.id, "Qualification", { type: "HUMAN" });

        const rows = await prisma.stageChange.findMany({ where: { mandateId: mandate.id } });
        expect(rows).toHaveLength(1);
        expect(rows[0].field).toBe("stage");
        expect(rows[0].fromValue).toBe("NewLead");
        expect(rows[0].toValue).toBe("Qualification");
        expect(rows[0].createdSource).toBe("HUMAN");

        // Restaging to the SAME value must not create a second row.
        await setMandateStage(mandate.id, "Qualification", { type: "HUMAN" });
        const rowsAfterNoop = await prisma.stageChange.findMany({ where: { mandateId: mandate.id } });
        expect(rowsAfterNoop).toHaveLength(1);

        // dealStatus change via the generic update service also writes a row.
        await updateMandate(mandate.id, { dealStatus: "OnHold" }, { type: "AGENT" });
        const dealStatusRows = await prisma.stageChange.findMany({
          where: { mandateId: mandate.id, field: "dealStatus" },
        });
        expect(dealStatusRows).toHaveLength(1);
        expect(dealStatusRows[0].fromValue).toBe("Open");
        expect(dealStatusRows[0].toValue).toBe("OnHold");
        expect(dealStatusRows[0].createdSource).toBe("AGENT");
      } finally {
        await prisma.stageChange.deleteMany({ where: { mandateId: mandate.id } });
        await deleteMandate(mandate.id);
        await deleteClient(client.id);
      }
      return true;
    });
    void ran;
  });

  it("records a StageChange row when a transaction restages or its dealStatus/dealMilestone change", async () => {
    const ran = await withDb(async () => {
      const client = await createClient({ name: "__stage_history_txn_client__" }, { type: "HUMAN" });
      const txn = await createTransaction({ name: "__stage_history_txn__", clientId: client.id }, { type: "HUMAN" });
      try {
        expect(txn.stage).toBe("DealPreparation");

        await setTransactionStage(txn.id, "InvestorOutreach", { type: "HUMAN" });
        const stageRows = await prisma.stageChange.findMany({ where: { transactionId: txn.id, field: "stage" } });
        expect(stageRows).toHaveLength(1);
        expect(stageRows[0].fromValue).toBe("DealPreparation");
        expect(stageRows[0].toValue).toBe("InvestorOutreach");

        await updateTransaction(txn.id, { dealStatus: "OnHold", dealMilestone: "TermSheet" }, { type: "HUMAN" });
        const dealStatusRows = await prisma.stageChange.findMany({ where: { transactionId: txn.id, field: "dealStatus" } });
        const milestoneRows = await prisma.stageChange.findMany({ where: { transactionId: txn.id, field: "dealMilestone" } });
        expect(dealStatusRows).toHaveLength(1);
        expect(dealStatusRows[0].toValue).toBe("OnHold");
        expect(milestoneRows).toHaveLength(1);
        expect(milestoneRows[0].fromValue).toBeNull();
        expect(milestoneRows[0].toValue).toBe("TermSheet");
      } finally {
        await prisma.stageChange.deleteMany({ where: { transactionId: txn.id } });
        await deleteTransaction(txn.id);
        await deleteClient(client.id);
      }
      return true;
    });
    void ran;
  });

  it("records a StageChange row when an engagement's engagementStage changes", async () => {
    const ran = await withDb(async () => {
      const client = await createClient({ name: "__stage_history_eng_client__" }, { type: "HUMAN" });
      const txn = await createTransaction({ name: "__stage_history_eng_txn__", clientId: client.id }, { type: "HUMAN" });
      const investor = await prisma.investor.create({
        data: { name: "__stage_history_investor__", investorType: "VentureCapital" },
      });
      let engagement: Awaited<ReturnType<typeof createEngagement>> | null = null;
      try {
        engagement = await createEngagement(
          { transactionId: txn.id, investorId: investor.id },
          { type: "HUMAN" },
        );
        expect(engagement.engagementStage).toBe("Shared");

        // TeaserSent does not require an NDA, so this is a valid transition.
        await updateEngagement(engagement.id, { engagementStage: "TeaserSent" }, { type: "HUMAN" });

        const rows = await prisma.stageChange.findMany({ where: { engagementId: engagement.id } });
        expect(rows).toHaveLength(1);
        expect(rows[0].field).toBe("engagementStage");
        expect(rows[0].fromValue).toBe("Shared");
        expect(rows[0].toValue).toBe("TeaserSent");
      } finally {
        if (engagement != null) {
          await prisma.stageChange.deleteMany({ where: { engagementId: engagement.id } });
          await prisma.engagement.delete({ where: { id: engagement.id } });
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
