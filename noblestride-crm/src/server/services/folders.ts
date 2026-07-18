// Folder service — hierarchical file room (client feedback 2026-07).
// Folders ORGANIZE documents; they never grant access. Investor-facing
// visibility keeps flowing through DocumentAccessLevel + documents/authz.ts,
// and storage keys (storage/keys.ts) are untouched — a move is a DB-only op.
// Thin layer: Prisma + domain helpers only. No GraphQL, no React.

import { prisma } from "@/lib/db";
import type { Folder } from "@prisma/client";
import { CrudError } from "./crud";
import { DEAL_FOLDER_TEMPLATE } from "@/server/domain/folder-templates";

/** One deal/client/investor anchor for a root folder. */
export interface FolderEntityRef {
  transactionId?: string;
  mandateId?: string;
  advisoryId?: string;
  clientId?: string;
  investorId?: string;
}

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  documentCount: number;
  children: FolderNode[];
}

/** Full folder forest with per-folder document counts, roots sorted by name. */
export async function folderTree(): Promise<FolderNode[]> {
  const folders = await prisma.folder.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { documents: true } } },
  });
  const nodes = new Map<string, FolderNode>(
    folders.map((f) => [f.id, { id: f.id, name: f.name, parentId: f.parentId, documentCount: f._count.documents, children: [] }]),
  );
  const roots: FolderNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Breadcrumb chain root→folder. Throws CrudError when the id is unknown. */
export async function folderPath(id: string): Promise<{ id: string; name: string }[]> {
  const chain: { id: string; name: string }[] = [];
  let cursor: string | null = id;
  // Walk up parent links; depth is bounded by the tree height, and the cycle
  // guard in moveFolder keeps the structure acyclic.
  while (cursor) {
    const folder: Pick<Folder, "id" | "name" | "parentId"> | null = await prisma.folder.findUnique({
      where: { id: cursor },
      select: { id: true, name: true, parentId: true },
    });
    if (!folder) {
      if (chain.length === 0) throw new CrudError("Folder not found");
      break;
    }
    chain.unshift({ id: folder.id, name: folder.name });
    cursor = folder.parentId;
  }
  return chain;
}

export async function createFolder(input: { name: string; parentId?: string | null } & FolderEntityRef, createdById?: string) {
  const name = input.name.trim();
  if (!name) throw new CrudError("Folder name is required");
  try {
    return await prisma.folder.create({
      data: {
        name,
        parentId: input.parentId ?? null,
        transactionId: input.transactionId,
        mandateId: input.mandateId,
        advisoryId: input.advisoryId,
        clientId: input.clientId,
        investorId: input.investorId,
        createdById,
      },
    });
  } catch (err) {
    // @@unique([parentId, name])
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      throw new CrudError(`A folder named "${name}" already exists here.`);
    }
    throw err;
  }
}

export async function renameFolder(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new CrudError("Folder name is required");
  try {
    return await prisma.folder.update({ where: { id }, data: { name: trimmed } });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      throw new CrudError(`A folder named "${trimmed}" already exists here.`);
    }
    throw err;
  }
}

/** Move a folder under a new parent (null = root). Walk-up cycle guard. */
export async function moveFolder(id: string, newParentId: string | null) {
  if (newParentId) {
    let cursor: string | null = newParentId;
    while (cursor) {
      if (cursor === id) throw new CrudError("Cannot move a folder into itself or its own subtree.");
      const parent: { parentId: string | null } | null = await prisma.folder.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      if (!parent) throw new CrudError("Destination folder not found");
      cursor = parent.parentId;
    }
  }
  return prisma.folder.update({ where: { id }, data: { parentId: newParentId } });
}

/** Deleting a folder cascades to child folders; documents are SetNull → unfiled. */
export async function deleteFolder(id: string) {
  return prisma.folder.delete({ where: { id } });
}

/** Move a document into a folder (or null = unfiled). DB-only; storage untouched. */
export async function moveDocumentToFolder(documentId: string, folderId: string | null) {
  if (folderId) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId }, select: { id: true } });
    if (!folder) throw new CrudError("Destination folder not found");
  }
  return prisma.document.update({ where: { id: documentId }, data: { folderId } });
}

/**
 * Lazily create the template file room for a deal: a root folder named after
 * the deal with the standard sub-folders. Idempotent — returns the existing
 * root if one is already anchored to the entity.
 */
export async function ensureDefaultFolders(ref: FolderEntityRef & { rootName: string }, createdById?: string) {
  const anchor = {
    ...(ref.transactionId ? { transactionId: ref.transactionId } : {}),
    ...(ref.mandateId ? { mandateId: ref.mandateId } : {}),
    ...(ref.advisoryId ? { advisoryId: ref.advisoryId } : {}),
    ...(ref.clientId ? { clientId: ref.clientId } : {}),
    ...(ref.investorId ? { investorId: ref.investorId } : {}),
  };
  if (Object.keys(anchor).length === 0) throw new CrudError("ensureDefaultFolders needs an entity anchor");

  const existing = await prisma.folder.findFirst({ where: { ...anchor, parentId: null } });
  if (existing) return existing;

  const root = await prisma.folder.create({ data: { name: ref.rootName, ...anchor, createdById } });
  await prisma.folder.createMany({
    data: DEAL_FOLDER_TEMPLATE.map((name) => ({ name, parentId: root.id, createdById })),
  });
  return root;
}
