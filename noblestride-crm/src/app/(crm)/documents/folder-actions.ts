"use server";

// File-room server actions (client feedback 2026-07). Folder writes are
// staff-only (Documents:U per the RBAC matrix — folders organize documents),
// checked server-side on every action. Folders never affect access levels.

import { revalidatePath } from "next/cache";
import { getOrgLens } from "@/server/rbac/context";
import { can } from "@/server/rbac/matrix";
import { CrudError } from "@/server/services/crud";
import {
  createFolder,
  renameFolder,
  moveFolder,
  deleteFolder,
  moveDocumentToFolder,
} from "@/server/services/folders";

export interface FolderActionState {
  error?: string;
}

async function guard(): Promise<string | null> {
  const lens = await getOrgLens();
  if (!can(lens.orgRole, "Documents", "U")) return "You don't have permission to manage folders.";
  return null;
}

async function run(fn: () => Promise<unknown>): Promise<FolderActionState> {
  const denied = await guard();
  if (denied) return { error: denied };
  try {
    await fn();
  } catch (err) {
    if (err instanceof CrudError) return { error: err.message };
    console.error("folder action failed", err);
    return { error: "Something went wrong — try again." };
  }
  revalidatePath("/documents");
  return {};
}

export async function createFolderAction(input: { name: string; parentId?: string | null }): Promise<FolderActionState> {
  const lens = await getOrgLens();
  return run(() => createFolder({ name: input.name, parentId: input.parentId ?? null }, lens.userId ?? undefined));
}

export async function renameFolderAction(id: string, name: string): Promise<FolderActionState> {
  return run(() => renameFolder(id, name));
}

export async function moveFolderAction(id: string, newParentId: string | null): Promise<FolderActionState> {
  return run(() => moveFolder(id, newParentId));
}

export async function deleteFolderAction(id: string): Promise<FolderActionState> {
  return run(() => deleteFolder(id));
}

export async function moveDocumentAction(documentId: string, folderId: string | null): Promise<FolderActionState> {
  return run(() => moveDocumentToFolder(documentId, folderId));
}
