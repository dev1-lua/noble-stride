// DB-backed smoke tests for the comprehensive deal editor: stage change via the
// generic update service (full restage semantics) + NDA/EA date auto-stamp and
// its effect on the Deal Journey. Uses the project's withDb skip pattern.

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createClient, deleteClient } from "@/server/services/clients";
import { createMandate, deleteMandate, updateMandate } from "@/server/services/mandates";
import { createTransaction, deleteTransaction, updateTransaction } from "@/server/services/transactions";
import { journeyForMandate } from "@/server/services/journey";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await fn();
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    if (["ECONNREFUSED", "ENOTFOUND", "connect", "Can't reach database", "P1001", "P1002"].some((s) => m.includes(s))) {
      return null;
    }
    throw err;
  }
}

const stepState = (steps: Awaited<ReturnType<typeof journeyForMandate>>, index: number) =>
  steps?.find((s) => s.index === index)?.state;

describe("deal editor — mandate (smoke)", () => {
  it("changing stage via updateMandate records history and resets the timer", async () => {
    const ran = await withDb(async () => {
      const client = await createClient({ name: "__editor_m_client__" }, { type: "HUMAN" });
      const mandate = await createMandate({ name: "__editor_m__", clientId: client.id }, { type: "HUMAN" });
      try {
        const before = await prisma.mandate.findUniqueOrThrow({ where: { id: mandate.id } });
        await updateMandate(mandate.id, { stage: "Qualification" }, { type: "HUMAN" });

        const after = await prisma.mandate.findUniqueOrThrow({ where: { id: mandate.id } });
        expect(after.stage).toBe("Qualification");
        expect(after.stageEnteredAt.getTime()).toBeGreaterThanOrEqual(before.stageEnteredAt.getTime());

        const rows = await prisma.stageChange.findMany({ where: { mandateId: mandate.id, field: "stage" } });
        expect(rows).toHaveLength(1);
        expect(rows[0].toValue).toBe("Qualification");

        // Editing a non-stage field must NOT add another stage row.
        await updateMandate(mandate.id, { notes: "hello" }, { type: "HUMAN" });
        const rows2 = await prisma.stageChange.findMany({ where: { mandateId: mandate.id, field: "stage" } });
        expect(rows2).toHaveLength(1);
      } finally {
        await prisma.stageChange.deleteMany({ where: { mandateId: mandate.id } });
        await deleteMandate(mandate.id);
        await deleteClient(client.id);
      }
      return true;
    });
    void ran;
  });

  it("setting NDA status to Signed stamps ndaSignedDate and greens journey step 3; downgrade clears it", async () => {
    const ran = await withDb(async () => {
      const client = await createClient({ name: "__editor_nda_client__" }, { type: "HUMAN" });
      const mandate = await createMandate({ name: "__editor_nda__", clientId: client.id }, { type: "HUMAN" });
      try {
        await updateMandate(mandate.id, { ndaStatus: "Signed" }, { type: "HUMAN" });
        const signed = await prisma.mandate.findUniqueOrThrow({ where: { id: mandate.id } });
        expect(signed.ndaSignedDate).not.toBeNull();
        expect(stepState(await journeyForMandate(mandate.id), 3)).toBe("done");

        await updateMandate(mandate.id, { ndaStatus: "Sent" }, { type: "HUMAN" });
        const lowered = await prisma.mandate.findUniqueOrThrow({ where: { id: mandate.id } });
        expect(lowered.ndaSignedDate).toBeNull();
        expect(lowered.ndaSentDate).not.toBeNull();
        expect(stepState(await journeyForMandate(mandate.id), 3)).not.toBe("done");
      } finally {
        await deleteMandate(mandate.id);
        await deleteClient(client.id);
      }
      return true;
    });
    void ran;
  });

  it("creating a mandate with NDA already Signed stamps the date", async () => {
    const ran = await withDb(async () => {
      const client = await createClient({ name: "__editor_create_client__" }, { type: "HUMAN" });
      const mandate = await createMandate(
        { name: "__editor_create__", clientId: client.id, ndaStatus: "Signed" },
        { type: "HUMAN" },
      );
      try {
        const row = await prisma.mandate.findUniqueOrThrow({ where: { id: mandate.id } });
        expect(row.ndaSignedDate).not.toBeNull();
      } finally {
        await deleteMandate(mandate.id);
        await deleteClient(client.id);
      }
      return true;
    });
    void ran;
  });
});

describe("deal editor — transaction (smoke)", () => {
  it("changing stage via updateTransaction records history, resets timer, and sets closedAt on ClosedWon", async () => {
    const ran = await withDb(async () => {
      const client = await createClient({ name: "__editor_t_client__" }, { type: "HUMAN" });
      const txn = await createTransaction({ name: "__editor_t__", clientId: client.id }, { type: "HUMAN" });
      try {
        await updateTransaction(txn.id, { stage: "ClosedWon" }, { type: "HUMAN" });
        const won = await prisma.transaction.findUniqueOrThrow({ where: { id: txn.id } });
        expect(won.stage).toBe("ClosedWon");
        expect(won.closedAt).not.toBeNull();

        const rows = await prisma.stageChange.findMany({ where: { transactionId: txn.id, field: "stage" } });
        expect(rows).toHaveLength(1);
        expect(rows[0].toValue).toBe("ClosedWon");

        // Re-opening clears closedAt.
        await updateTransaction(txn.id, { stage: "DueDiligence" }, { type: "HUMAN" });
        const reopened = await prisma.transaction.findUniqueOrThrow({ where: { id: txn.id } });
        expect(reopened.closedAt).toBeNull();

        // Non-stage edit adds no new stage row.
        await updateTransaction(txn.id, { notes: "x" }, { type: "HUMAN" });
        const rows2 = await prisma.stageChange.findMany({ where: { transactionId: txn.id, field: "stage" } });
        expect(rows2).toHaveLength(2); // ClosedWon + DueDiligence, not 3
      } finally {
        await prisma.stageChange.deleteMany({ where: { transactionId: txn.id } });
        await deleteTransaction(txn.id);
        await deleteClient(client.id);
      }
      return true;
    });
    void ran;
  });
});
