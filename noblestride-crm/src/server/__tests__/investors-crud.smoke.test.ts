import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createInvestor, deleteInvestor } from "@/server/services/investors";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try { return await fn(); }
  catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

describe("investor CRUD (smoke)", () => {
  it("createInvestor stamps createdSource from the actor, then deletes", async () => {
    const out = await withDb(async () => {
      const inv = await createInvestor(
        { name: "ZZ Test Fund", investorType: "VentureCapital", sectorFocus: ["Technology"] },
        { type: "AGENT" }
      );
      expect(inv.name).toBe("ZZ Test Fund");
      expect(inv.createdSource).toBe("AGENT");
      const removed = await deleteInvestor(inv.id);
      expect(removed.id).toBe(inv.id);
      return true;
    });
    if (out === null) return; // DB down — skip
  });
});
