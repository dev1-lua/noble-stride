import { describe, it, expect } from "vitest";
import { createClient, deleteClient } from "@/server/services/clients";
import { createTransaction, deleteTransaction } from "@/server/services/transactions";

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
