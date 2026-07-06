// Document service — single source of truth over Prisma for document metadata.
// Thin layer: Prisma calls + domain helpers only. No GraphQL, no React.

import { prisma } from "@/lib/db";
import { actorSource, CrudError } from "./crud";
import type { Actor } from "@/graphql/context";
import { documentCreateSchema, documentUpdateSchema } from "@/lib/schemas/document";

export interface DocumentFilter {
  transactionId?: string;
  clientId?: string;
  investorId?: string;
  mandateId?: string;
}

export const listDocuments = (filter?: DocumentFilter) =>
  prisma.document.findMany({
    where: {
      ...(filter?.transactionId != null && { transactionId: filter.transactionId }),
      ...(filter?.clientId != null && { clientId: filter.clientId }),
      ...(filter?.investorId != null && { investorId: filter.investorId }),
      ...(filter?.mandateId != null && { mandateId: filter.mandateId }),
    },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: true, reviewer: true, approver: true, transaction: true, client: true, investor: true },
  });

export const getDocument = (id: string) =>
  prisma.document.findUnique({
    where: { id },
    include: { uploadedBy: true, transaction: true, client: true, investor: true },
  });

export async function createDocument(raw: unknown, actor: Actor) {
  const input = documentCreateSchema.parse(raw);
  return prisma.document.create({ data: { ...input, createdSource: actorSource(actor) } as never });
}

export async function updateDocument(id: string, raw: unknown) {
  const input = documentUpdateSchema.parse(raw);
  return prisma.document.update({ where: { id }, data: input as never });
}

export async function deleteDocument(id: string) {
  try {
    return await prisma.document.delete({ where: { id } });
  } catch {
    throw new CrudError("Document not found");
  }
}
