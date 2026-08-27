// Client service — single source of truth over Prisma for client data.
// Thin layer: Prisma calls only. No GraphQL, no React.

import { prisma } from "@/lib/db";
import { clientCreateSchema, clientUpdateSchema, type ClientCreateInput, type ClientUpdateInput } from "@/lib/schemas/client";
import { actorSource, CrudError } from "./crud";
import { recordStageChange } from "./stage-history";
import type { Actor } from "@/graphql/context";

/**
 * List all clients ordered by name asc.
 */
export async function listClients() {
  return prisma.client.findMany({ orderBy: { name: "asc" } });
}

/**
 * Fetch a single client by id, including contacts, mandates, transactions,
 * and activities (newest first — spec §3.10 comm logging against a bare
 * client). Returns null when the client does not exist.
 */
export async function getClient(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      contacts: true,
      mandates: true,
      transactions: true,
      activities: { orderBy: { occurredAt: "desc" }, include: { tasks: { select: { id: true, title: true, status: true } } } },
      stageChanges: { orderBy: { changedAt: "desc" }, include: { changedBy: true } },
    },
  });
}

/**
 * Aug-2026 feedback: `projectCodename` and the `womenLed`/`youthLed` booleans
 * are the fields the UI now writes, but `codename` and `impactFlags` are still
 * part of the API surface (and read by the portal/agents), so every write
 * mirrors the pair in both directions. Whichever side the caller supplied wins;
 * when both are supplied the new field wins.
 */
function mirrorClientFields<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data };

  // codename <-> projectCodename
  if (out.projectCodename !== undefined && out.codename === undefined) out.codename = out.projectCodename;
  else if (out.codename !== undefined && out.projectCodename === undefined) out.projectCodename = out.codename;

  // womenLed/youthLed <-> impactFlags
  const flags = out.impactFlags as string[] | undefined;
  const hasBooleans = out.womenLed !== undefined || out.youthLed !== undefined;
  if (hasBooleans) {
    const next = new Set<string>(flags ?? []);
    if (out.womenLed === true) next.add("WomenLed");
    if (out.womenLed === false) next.delete("WomenLed");
    if (out.youthLed === true) next.add("YouthLed");
    if (out.youthLed === false) next.delete("YouthLed");
    out.impactFlags = [...next];
  } else if (flags !== undefined) {
    out.womenLed = flags.includes("WomenLed");
    out.youthLed = flags.includes("YouthLed");
  }
  return out as T;
}

export async function createClient(input: ClientCreateInput, actor: Actor) {
  const data = mirrorClientFields(clientCreateSchema.parse(input));
  return prisma.client.create({ data: { ...data, createdSource: actorSource(actor) } });
}

export async function updateClient(id: string, input: ClientUpdateInput, actor: Actor = { type: "HUMAN" }) {
  const data = mirrorClientFields(clientUpdateSchema.parse(input));
  return prisma.$transaction(async (tx) => {
    const existing = await tx.client.findUniqueOrThrow({ where: { id }, select: { name: true, registrationNo: true } });
    const updated = await tx.client.update({ where: { id }, data });
    if (data.name !== undefined) {
      await recordStageChange(tx, { field: "name", fromValue: existing.name, toValue: data.name, actor, clientId: id });
    }
    if (data.registrationNo !== undefined) {
      await recordStageChange(tx, { field: "registrationNo", fromValue: existing.registrationNo, toValue: data.registrationNo, actor, clientId: id });
    }
    return updated;
  });
}

export async function deleteClient(id: string) {
  const [mandates, transactions] = await Promise.all([
    prisma.mandate.count({ where: { clientId: id } }),
    prisma.transaction.count({ where: { clientId: id } }),
  ]);
  if (mandates > 0 || transactions > 0) {
    throw new CrudError(
      `Cannot delete: ${mandates} mandate(s) and ${transactions} transaction(s) reference this client.`
    );
  }
  return prisma.client.delete({ where: { id } });
}
