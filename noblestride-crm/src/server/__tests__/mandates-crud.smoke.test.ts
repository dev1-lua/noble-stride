import { describe, it, expect } from "vitest";
import { createClient, deleteClient } from "@/server/services/clients";
import { createMandate, deleteMandate } from "@/server/services/mandates";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try { return await fn(); }
  catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

describe("mandate CRUD (smoke)", () => {
  it("creates a mandate at default stage NewLead and deletes it", async () => {
    const out = await withDb(async () => {
      const c = await createClient({ name: "ZZ Mandate Client" }, { type: "HUMAN" });
      const m = await createMandate({ name: "ZZ Mandate", clientId: c.id }, { type: "HUMAN" });
      expect(m.stage).toBe("NewLead");
      expect(m.createdSource).toBe("HUMAN");
      await deleteMandate(m.id);
      await deleteClient(c.id);
      return true;
    });
    if (out === null) return;
  });
});
