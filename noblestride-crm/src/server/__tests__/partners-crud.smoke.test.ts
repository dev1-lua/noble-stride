import { describe, it, expect } from "vitest";
import { createPartner, deletePartner } from "@/server/services/partners";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try { return await fn(); }
  catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

describe("partner CRUD (smoke)", () => {
  it("creates (default HUMAN) and deletes a partner", async () => {
    const out = await withDb(async () => {
      const p = await createPartner({ name: "ZZ Test Advisors", partnerType: "Advisor" }, { type: "HUMAN" });
      expect(p.createdSource).toBe("HUMAN");
      await deletePartner(p.id);
      return true;
    });
    if (out === null) return;
  });
});
