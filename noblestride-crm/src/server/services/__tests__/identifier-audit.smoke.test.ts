// DB-backed smoke test for the §7.1 core-identifier audit: renames of
// client/investor/partner and primary-contact reassignment write StageChange rows.

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createClient, updateClient, deleteClient } from "@/server/services/clients";
import { createInvestor, updateInvestor, deleteInvestor } from "@/server/services/investors";
import { createPartner, updatePartner, deletePartner } from "@/server/services/partners";
import { createPerson } from "@/server/services/persons";

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

describe("identifier audit (smoke)", () => {
  it("audits client name + registrationNo changes", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__audit_client_v1__" }, { type: "HUMAN" });
      try {
        await updateClient(client.id, { name: "__audit_client_v2__", registrationNo: "C-123" }, { type: "HUMAN" });

        const nameRows = await prisma.stageChange.findMany({ where: { clientId: client.id, field: "name" } });
        expect(nameRows).toHaveLength(1);
        expect(nameRows[0].fromValue).toBe("__audit_client_v1__");
        expect(nameRows[0].toValue).toBe("__audit_client_v2__");

        // registrationNo was null before → recordStageChange (fromValue null) still writes
        const regRows = await prisma.stageChange.findMany({ where: { clientId: client.id, field: "registrationNo" } });
        expect(regRows).toHaveLength(1);
        expect(regRows[0].toValue).toBe("C-123");

        // unchanged update writes nothing new
        await updateClient(client.id, { name: "__audit_client_v2__" }, { type: "HUMAN" });
        expect(await prisma.stageChange.count({ where: { clientId: client.id, field: "name" } })).toBe(1);
      } finally {
        await prisma.stageChange.deleteMany({ where: { clientId: client.id } });
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });

  it("audits investor and partner renames", async () => {
    const out = await withDb(async () => {
      const investor = await createInvestor({ name: "__audit_inv_v1__", investorType: "DFI" } as never, { type: "HUMAN" });
      const partner = await createPartner({ name: "__audit_partner_v1__" }, { type: "HUMAN" });
      try {
        await updateInvestor(investor.id, { name: "__audit_inv_v2__" }, { type: "HUMAN" });
        await updatePartner(partner.id, { name: "__audit_partner_v2__" }, { type: "HUMAN" });
        const invRows = await prisma.stageChange.findMany({ where: { investorId: investor.id, field: "name" } });
        expect(invRows).toHaveLength(1);
        const partnerRows = await prisma.stageChange.findMany({ where: { partnerId: partner.id, field: "name" } });
        expect(partnerRows).toHaveLength(1);
      } finally {
        await prisma.stageChange.deleteMany({ where: { OR: [{ investorId: investor.id }, { partnerId: partner.id }] } });
        await deleteInvestor(investor.id);
        await deletePartner(partner.id);
      }
      return true;
    });
    if (out === null) return;
  });

  it("audits primary-contact reassignment against the parent", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__audit_primary_client__" }, { type: "HUMAN" });
      try {
        await createPerson({ firstName: "First", lastName: "Primary", clientId: client.id, isPrimaryContact: true }, { type: "HUMAN" });
        await createPerson({ firstName: "Second", lastName: "Primary", clientId: client.id, isPrimaryContact: true }, { type: "HUMAN" });

        const rows = await prisma.stageChange.findMany({
          where: { clientId: client.id, field: "primaryContact" },
          orderBy: { changedAt: "asc" },
        });
        expect(rows).toHaveLength(2);
        expect(rows[0].fromValue).toBeNull();
        expect(rows[0].toValue).toBe("First Primary");
        expect(rows[1].fromValue).toBe("First Primary");
        expect(rows[1].toValue).toBe("Second Primary");
      } finally {
        await prisma.stageChange.deleteMany({ where: { clientId: client.id } });
        await prisma.person.deleteMany({ where: { clientId: client.id } });
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });
});
