// DB-backed smoke test for Person (contact) CRUD (spec §3.5).
// withDb pattern: skips cleanly when DATABASE_URL is unset or DB unreachable.

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createClient, deleteClient } from "@/server/services/clients";
import { createPerson, updatePerson, deletePerson } from "@/server/services/persons";

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

describe("person CRUD (smoke)", () => {
  it("rejects a contact with no parent link", async () => {
    const out = await withDb(async () => {
      await expect(createPerson({ firstName: "ZZ Orphan" })).rejects.toThrow(/linked to a client/i);
      return true;
    });
    if (out === null) return;
  });

  it("creates, updates, and deletes a contact under a client", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__person_crud_client__" }, { type: "HUMAN" });
      try {
        const created = await createPerson({ firstName: "ZZ", lastName: "Contact", email: "zz@x.com", clientId: client.id });
        expect(created.firstName).toBe("ZZ");
        expect(created.clientId).toBe(client.id);
        expect(created.isPrimaryContact).toBe(false);

        const updated = await updatePerson(created.id, { jobTitle: "CFO", phone: "+254700000000" });
        expect(updated.jobTitle).toBe("CFO");

        // clearing all parents on update is rejected
        await expect(updatePerson(created.id, { clientId: null } as never)).rejects.toThrow();

        await deletePerson(created.id);
        expect(await prisma.person.findUnique({ where: { id: created.id } })).toBeNull();
      } finally {
        await prisma.person.deleteMany({ where: { clientId: client.id } });
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });

  it("keeps exactly one primary contact per parent", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__person_primary_client__" }, { type: "HUMAN" });
      try {
        const a = await createPerson({ firstName: "ZZ A", clientId: client.id, isPrimaryContact: true });
        expect(a.isPrimaryContact).toBe(true);

        const b = await createPerson({ firstName: "ZZ B", clientId: client.id, isPrimaryContact: true });
        expect(b.isPrimaryContact).toBe(true);
        const aAfter = await prisma.person.findUniqueOrThrow({ where: { id: a.id } });
        expect(aAfter.isPrimaryContact).toBe(false);

        // promoting via update also demotes the sibling
        await updatePerson(a.id, { isPrimaryContact: true });
        const bAfter = await prisma.person.findUniqueOrThrow({ where: { id: b.id } });
        expect(bAfter.isPrimaryContact).toBe(false);
      } finally {
        await prisma.person.deleteMany({ where: { clientId: client.id } });
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });
});
