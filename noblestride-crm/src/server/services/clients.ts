// Client service — single source of truth over Prisma for client data.
// Thin layer: Prisma calls only. No GraphQL, no React.

import { prisma } from "@/lib/db";
import { clientCreateSchema, clientUpdateSchema, type ClientCreateInput, type ClientUpdateInput } from "@/lib/schemas/client";
import { actorSource, CrudError } from "./crud";
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
      activities: { orderBy: { occurredAt: "desc" } },
    },
  });
}

export async function createClient(input: ClientCreateInput, actor: Actor) {
  const data = clientCreateSchema.parse(input);
  return prisma.client.create({ data: { ...data, createdSource: actorSource(actor) } });
}

export async function updateClient(id: string, input: ClientUpdateInput) {
  const data = clientUpdateSchema.parse(input);
  return prisma.client.update({ where: { id }, data });
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
