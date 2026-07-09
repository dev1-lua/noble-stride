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
import { recordStageChange } from "./stage-history";
import { personCreateSchema, personUpdateSchema } from "@/lib/schemas/person";
import type { Actor } from "@/graphql/context";

const PARENT_FIELDS = ["clientId", "investorId", "partnerId"] as const;
type ParentField = (typeof PARENT_FIELDS)[number];
type ParentLinks = Partial<Record<ParentField, string | null | undefined>>;

const hasParent = (p: ParentLinks) => PARENT_FIELDS.some((f) => Boolean(p[f]));

const displayName = (p: { firstName: string; lastName: string | null }) =>
  [p.firstName, p.lastName].filter(Boolean).join(" ");

/** Demote the parent's current primary and audit the handover (spec §7.1). */
async function reassignPrimary(
  tx: Prisma.TransactionClient,
  parents: ParentLinks,
  person: { id: string; firstName: string; lastName: string | null },
  actor: Actor,
) {
  for (const field of PARENT_FIELDS) {
    const parentId = parents[field];
    if (!parentId) continue;
    const prev = await tx.person.findFirst({
      where: { [field]: parentId, isPrimaryContact: true, id: { not: person.id } },
      select: { id: true, firstName: true, lastName: true },
    });
    if (prev) {
      await tx.person.update({ where: { id: prev.id }, data: { isPrimaryContact: false } });
    }
    await recordStageChange(tx, {
      field: "primaryContact",
      fromValue: prev ? displayName(prev) : null,
      toValue: displayName(person),
      actor,
      [field]: parentId,
    });
  }
}

export async function createPerson(raw: unknown, actor: Actor = { type: "HUMAN" }) {
  const input = personCreateSchema.parse(raw);
  if (!hasParent(input)) {
    throw new CrudError("A contact must be linked to a client, investor, or partner.");
  }
  return prisma.$transaction(async (tx) => {
    const created = await tx.person.create({ data: input });
    if (input.isPrimaryContact) await reassignPrimary(tx, input, created, actor);
    return created;
  });
}

export async function updatePerson(id: string, raw: unknown, actor: Actor = { type: "HUMAN" }) {
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
    const updated = await tx.person.update({ where: { id }, data: input });
    if (input.isPrimaryContact) await reassignPrimary(tx, merged, updated, actor);
    return updated;
  });
}

export async function deletePerson(id: string) {
  try {
    return await prisma.person.delete({ where: { id } });
  } catch {
    throw new CrudError("Contact not found");
  }
}
