// Person (contact) service — single source of truth over Prisma for contacts
// (spec §3.5). Thin layer: Prisma calls + domain rules only. No GraphQL, no React.
//
// Domain rules:
//   1. A contact must link to ≥1 parent (client / investor / partner) — like
//      logActivity's "at least one linked record" rule.
//   2. One primary contact per parent: setting isPrimaryContact=true demotes
//      the parent's other contacts inside the same $transaction.

import { prisma } from "@/lib/db";
import type { Prisma, PortalMemberRole } from "@prisma/client";
import { CrudError } from "./crud";
import { recordStageChange } from "./stage-history";
import { personCreateSchema, personUpdateSchema } from "@/lib/schemas/person";
import type { Actor } from "@/graphql/context";
import { normalizeEmail } from "@/server/auth/guardrails";
import { changeAccountEmailByStaff, EmailChangeError } from "@/server/auth/change-email";

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
  const existing = await prisma.person.findUnique({ where: { id }, include: { authAccount: true } });
  if (!existing) throw new CrudError("Contact not found");
  const merged: ParentLinks = {
    clientId: "clientId" in input ? input.clientId : existing.clientId,
    investorId: "investorId" in input ? input.investorId : existing.investorId,
    partnerId: "partnerId" in input ? input.partnerId : existing.partnerId,
  };
  if (!hasParent(merged)) {
    throw new CrudError("A contact must remain linked to a client, investor, or partner.");
  }
  // F3.6 (image11/12): if this contact can sign in, the email on their account
  // has to move with the contact record — otherwise the login address silently
  // goes stale. changeAccountEmailByStaff owns that write (it also updates
  // Person.email, records the audit rows and ends their sessions), so `email` is
  // dropped from the person update below rather than written twice.
  const emailChanged =
    typeof input.email === "string" &&
    input.email.trim().length > 0 &&
    normalizeEmail(input.email) !== normalizeEmail(existing.email ?? "");
  const accountId = existing.authAccount?.id;
  // Omit `email` from the person update when the service above owns that write.
  const data =
    emailChanged && accountId
      ? Object.fromEntries(Object.entries(input).filter(([k]) => k !== "email"))
      : input;

  if (emailChanged && accountId) {
    try {
      await changeAccountEmailByStaff(accountId, input.email as string, actor);
    } catch (err) {
      if (err instanceof EmailChangeError) throw new CrudError(err.message);
      throw err;
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.person.update({ where: { id }, data });
    if (input.isPrimaryContact) await reassignPrimary(tx, merged, updated, actor);
    return updated;
  });
}

export interface InvestorPersonHit {
  personId: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  investorId: string;
  investorName: string;
  portalRole: PortalMemberRole;
  hasAccount: boolean;
}

/**
 * Search people across every investor org (F3.4 / image9: "I want an overview of
 * all investors — I search a person and get their profile, their fund and their
 * contacts").
 *
 * Deliberately separate from the investor-list filter: that one narrows the list
 * of FUNDS, while this answers "who is this person?" and links straight to their
 * row on the fund page. A one-character query returns nothing — matching a third
 * of the address book is not a search result.
 */
export async function searchInvestorPeople(q: string, limit = 20): Promise<InvestorPersonHit[]> {
  const needle = q.trim();
  if (needle.length < 2) return [];

  const people = await prisma.person.findMany({
    where: {
      investorId: { not: null },
      OR: [
        { firstName: { contains: needle, mode: "insensitive" } },
        { lastName: { contains: needle, mode: "insensitive" } },
        { email: { contains: needle, mode: "insensitive" } },
        { jobTitle: { contains: needle, mode: "insensitive" } },
      ],
    },
    include: {
      investor: { select: { id: true, name: true } },
      authAccount: { select: { id: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: limit,
  });

  return people.flatMap((p) => {
    if (!p.investor) return [];
    return [{
      personId: p.id,
      name: [p.firstName, p.lastName].filter(Boolean).join(" "),
      jobTitle: p.jobTitle,
      email: p.email,
      phone: p.phone,
      investorId: p.investor.id,
      investorName: p.investor.name,
      portalRole: p.portalRole,
      hasAccount: Boolean(p.authAccount),
    }];
  });
}

export async function deletePerson(id: string) {
  try {
    return await prisma.person.delete({ where: { id } });
  } catch {
    throw new CrudError("Contact not found");
  }
}
