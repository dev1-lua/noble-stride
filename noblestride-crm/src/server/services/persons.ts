// Person (contact) service — single source of truth over Prisma for contacts
// (spec §3.5). Thin layer: Prisma calls + domain rules only. No GraphQL, no React.
//
// Domain rules:
//   1. A contact must link to ≥1 parent (client / investor / partner) — like
//      logActivity's "at least one linked record" rule.
//   2. One primary contact per parent: setting isPrimaryContact=true demotes
//      the parent's other contacts inside the same $transaction.

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { CrudError } from "./crud";
import { personCreateSchema, personUpdateSchema } from "@/lib/schemas/person";

const PARENT_FIELDS = ["clientId", "investorId", "partnerId"] as const;
type ParentField = (typeof PARENT_FIELDS)[number];
type ParentLinks = Partial<Record<ParentField, string | null | undefined>>;

const hasParent = (p: ParentLinks) => PARENT_FIELDS.some((f) => Boolean(p[f]));

/** Demote every other primary contact of the same parent(s). */
async function demoteSiblingPrimaries(tx: Prisma.TransactionClient, parents: ParentLinks, excludeId?: string) {
  for (const field of PARENT_FIELDS) {
    const parentId = parents[field];
    if (!parentId) continue;
    await tx.person.updateMany({
      where: { [field]: parentId, isPrimaryContact: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
      data: { isPrimaryContact: false },
    });
  }
}

export async function createPerson(raw: unknown) {
  const input = personCreateSchema.parse(raw);
  if (!hasParent(input)) {
    throw new CrudError("A contact must be linked to a client, investor, or partner.");
  }
  return prisma.$transaction(async (tx) => {
    if (input.isPrimaryContact) await demoteSiblingPrimaries(tx, input);
    return tx.person.create({ data: input });
  });
}

export async function updatePerson(id: string, raw: unknown) {
  const input = personUpdateSchema.parse(raw);
  const existing = await prisma.person.findUnique({ where: { id } });
  if (!existing) throw new CrudError("Contact not found");
  const merged: ParentLinks = {
    clientId: "clientId" in input ? input.clientId : existing.clientId,
    investorId: "investorId" in input ? input.investorId : existing.investorId,
    partnerId: "partnerId" in input ? input.partnerId : existing.partnerId,
  };
  if (!hasParent(merged)) {
    throw new CrudError("A contact must remain linked to a client, investor, or partner.");
  }
  return prisma.$transaction(async (tx) => {
    if (input.isPrimaryContact) await demoteSiblingPrimaries(tx, merged, id);
    return tx.person.update({ where: { id }, data: input });
  });
}

export async function deletePerson(id: string) {
  try {
    return await prisma.person.delete({ where: { id } });
  } catch {
    throw new CrudError("Contact not found");
  }
}
