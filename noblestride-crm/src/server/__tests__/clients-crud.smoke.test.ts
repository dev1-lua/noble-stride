import { describe, it, expect } from "vitest";
import { createClient, deleteClient } from "@/server/services/clients";
import { createMandate, deleteMandate } from "@/server/services/mandates";
import { CrudError } from "@/server/services/crud";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try { return await fn(); }
  catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

describe("client CRUD (smoke)", () => {
  it("blocks delete when a mandate references the client", async () => {
    const out = await withDb(async () => {
      const c = await createClient({ name: "ZZ Test Co" }, { type: "HUMAN" });
      const m = await createMandate({ name: "ZZ Test Mandate", clientId: c.id }, { type: "HUMAN" });
      await expect(deleteClient(c.id)).rejects.toBeInstanceOf(CrudError);
      // cleanup: remove the mandate, then the client deletes cleanly
      await deleteMandate(m.id);
      await deleteClient(c.id);
      return true;
    });
    if (out === null) return;
  });
});
