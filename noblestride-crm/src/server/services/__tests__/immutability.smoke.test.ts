// DB-backed smoke test: Mandate.dateOpened/source and Transaction.dateOpened
// are immutable once set (spec §7.1) — set-when-null OK, identical resend OK,
// change rejected.

import { describe, it, expect } from "vitest";
import { createClient, deleteClient } from "@/server/services/clients";
import { createMandate, updateMandate, deleteMandate } from "@/server/services/mandates";
import { createTransaction, updateTransaction, deleteTransaction } from "@/server/services/transactions";
import { prisma } from "@/lib/db";

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

describe("identifier immutability (smoke)", () => {
  it("locks Mandate.dateOpened and Mandate.source once set", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__immutable_mandate_client__" }, { type: "HUMAN" });
      const mandate = await createMandate({ name: "__immutable_mandate__", clientId: client.id }, { type: "HUMAN" });
      try {
        const d1 = new Date("2026-01-01T00:00:00Z");
        // setting a null value is allowed
        await updateMandate(mandate.id, { dateOpened: d1, source: "Referral" }, { type: "HUMAN" });
        // re-sending the identical values is allowed (drawers resend everything)
        await updateMandate(mandate.id, { dateOpened: d1, source: "Referral" }, { type: "HUMAN" });
        // changing either is rejected
        await expect(
          updateMandate(mandate.id, { dateOpened: new Date("2026-02-02T00:00:00Z") }, { type: "HUMAN" }),
        ).rejects.toThrow(/locked once set/i);
        await expect(
          updateMandate(mandate.id, { source: "Email" }, { type: "HUMAN" }),
        ).rejects.toThrow(/locked once set/i);
      } finally {
        await prisma.stageChange.deleteMany({ where: { mandateId: mandate.id } });
        await deleteMandate(mandate.id);
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });

  it("locks Transaction.dateOpened once set", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__immutable_txn_client__" }, { type: "HUMAN" });
      const txn = await createTransaction({ name: "__immutable_txn__", clientId: client.id }, { type: "HUMAN" });
      try {
        const d1 = new Date("2026-01-01T00:00:00Z");
        await updateTransaction(txn.id, { dateOpened: d1 }, { type: "HUMAN" });
        await updateTransaction(txn.id, { dateOpened: d1 }, { type: "HUMAN" });
        await expect(
          updateTransaction(txn.id, { dateOpened: new Date("2026-03-03T00:00:00Z") }, { type: "HUMAN" }),
        ).rejects.toThrow(/locked once set/i);
      } finally {
        await prisma.stageChange.deleteMany({ where: { transactionId: txn.id } });
        await deleteTransaction(txn.id);
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });
});
