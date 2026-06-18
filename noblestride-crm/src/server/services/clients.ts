// Client service — single source of truth over Prisma for client data.
// Thin layer: Prisma calls only. No GraphQL, no React.

import { prisma } from "@/lib/db";

/**
 * List all clients ordered by name asc.
 */
export async function listClients() {
  return prisma.client.findMany({ orderBy: { name: "asc" } });
}

/**
 * Fetch a single client by id, including contacts, mandates, and transactions.
 * Returns null when the client does not exist.
 */
export async function getClient(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      contacts: true,
      mandates: true,
      transactions: true,
    },
  });
}
