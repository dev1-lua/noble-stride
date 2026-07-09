// Document service — single source of truth over Prisma for document metadata.
// Thin layer: Prisma calls + domain helpers only. No GraphQL, no React.

import { prisma } from "@/lib/db";
import { actorSource, CrudError } from "./crud";
import type { Actor } from "@/graphql/context";
import { documentCreateSchema, documentUpdateSchema } from "@/lib/schemas/document";
import { getStorageProvider } from "@/server/storage/provider";

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

export async function createDocumentWithFile(
  meta: import("@/lib/schemas/document").DocumentCreateInput & { supersedesId?: string },
  file: {
    storageKey: string;
    storageProvider: string;
    mimeType: string;
    sizeBytes: number;
    checksum: string;
    originalFilename: string;
  },
  actor: Actor,
) {
  const { supersedesId, ...rest } = meta;
  return prisma.$transaction(async (tx) => {
    if (supersedesId) {
      const target = await tx.document.findUnique({ where: { id: supersedesId }, select: { isCurrent: true } });
      if (!target || !target.isCurrent) {
        throw new CrudError("Cannot supersede a non-current document version");
      }
      await tx.document.update({ where: { id: supersedesId }, data: { isCurrent: false } });
    }
    return tx.document.create({
      data: {
        ...rest,
        ...file,
        previousVersionId: supersedesId ?? null,
        isCurrent: true,
        createdSource: actorSource(actor),
      } as never,
    });
  });
}

export async function logDocumentAccess(
  documentId: string,
  userId: string | null,
  action: "UPLOAD" | "DOWNLOAD" | "DELETE",
): Promise<void> {
  await prisma.documentAccessLog.create({ data: { documentId, userId, action } });
}

export async function deleteDocumentVersion(id: string) {
  const deleted = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.findUnique({ where: { id } });
    if (!doc) throw new CrudError("Document not found");
    if (doc.isCurrent && doc.previousVersionId) {
      await tx.document.update({ where: { id: doc.previousVersionId }, data: { isCurrent: true } });
    }
    return tx.document.delete({ where: { id } });
  });
  // Best-effort: remove the stored bytes once the row is gone. A storage
  // failure here must not resurrect or block the (already-committed) delete.
  if (deleted.storageKey) {
    await getStorageProvider().delete(deleted.storageKey).catch(() => {});
  }
  return deleted;
}
