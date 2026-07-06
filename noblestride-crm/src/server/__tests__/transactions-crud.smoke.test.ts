import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createClient, deleteClient } from "@/server/services/clients";
import { createTransaction, updateTransaction, deleteTransaction } from "@/server/services/transactions";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try { return await fn(); }
  catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

describe("transaction CRUD (smoke)", () => {
  it("creates a transaction at default stage DealPreparation and deletes it", async () => {
    const out = await withDb(async () => {
      const c = await createClient({ name: "ZZ Txn Client" }, { type: "HUMAN" });
      const t = await createTransaction(
        { name: "ZZ Txn", clientId: c.id, targetRaise: 1000000 },
        { type: "API" }
      );
      expect(t.stage).toBe("DealPreparation");
      expect(t.createdSource).toBe("API");
      await deleteTransaction(t.id);
      await deleteClient(c.id);
      return true;
    });
    if (out === null) return;
  });
});

describe("transaction service-provider linking (smoke)", () => {
  it("connects on create and replaces via set on update", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__txn_sp_client__" }, { type: "HUMAN" });
      const spA = await prisma.serviceProvider.create({ data: { name: "__sp_a__", type: "Audit" } });
      const spB = await prisma.serviceProvider.create({ data: { name: "__sp_b__", type: "LawFirm" } });
      let txnId: string | null = null;
      try {
        const txn = await createTransaction(
          { name: "__txn_sp__", clientId: client.id, serviceProviderIds: [spA.id] } as never,
          { type: "HUMAN" },
        );
        txnId = txn.id;
        let linked = await prisma.transaction.findUniqueOrThrow({ where: { id: txn.id }, include: { serviceProviders: true } });
        expect(linked.serviceProviders.map((s) => s.id)).toEqual([spA.id]);

        await updateTransaction(txn.id, { serviceProviderIds: [spB.id] } as never, { type: "HUMAN" });
        linked = await prisma.transaction.findUniqueOrThrow({ where: { id: txn.id }, include: { serviceProviders: true } });
        expect(linked.serviceProviders.map((s) => s.id)).toEqual([spB.id]);
      } finally {
        if (txnId) await deleteTransaction(txnId);
        await prisma.serviceProvider.deleteMany({ where: { id: { in: [spA.id, spB.id] } } });
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });
});
