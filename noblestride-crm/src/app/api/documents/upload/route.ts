import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { validateUpload } from "@/server/storage/validation";
import { getStorageProvider, StorageError } from "@/server/storage/provider";
import { buildObjectKey } from "@/server/storage/keys";
import { createDocumentWithFile, logDocumentAccess } from "@/server/services/documents";
import { documentCreateSchema } from "@/lib/schemas/document";

export const runtime = "nodejs";

function entityRef(meta: Record<string, string | undefined>): { entityType: string; entityId: string } {
  if (meta.transactionId) return { entityType: "transaction", entityId: meta.transactionId };
  if (meta.mandateId) return { entityType: "mandate", entityId: meta.mandateId };
  if (meta.clientId) return { entityType: "client", entityId: meta.clientId };
  if (meta.investorId) return { entityType: "investor", entityId: meta.investorId };
  if (meta.partnerId) return { entityType: "partner", entityId: meta.partnerId };
  return { entityType: "unfiled", entityId: "unfiled" };
}

export async function POST(request: Request): Promise<Response> {
  const vp = await getViewpoint();
  if (!vp) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (vp.role !== "admin") return Response.json({ error: "Upload is staff-only" }, { status: 403 });

  const fd = await request.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Missing file" }, { status: 400 });

  const raw: Record<string, string | undefined> = {};
  for (const k of ["name", "type", "accessLevel", "status", "version", "transactionId", "clientId", "investorId", "mandateId", "partnerId", "folderId", "supersedesId"]) {
    const val = fd.get(k);
    if (typeof val === "string" && val.length > 0) raw[k] = val;
  }

  const parsed = documentCreateSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid metadata" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const check = validateUpload(file.name, file.type, bytes);
  if (!check.ok) return Response.json({ error: check.reason }, { status: 400 });

  // Create the row first to obtain an id for the key, then store bytes, then finalize.
  const { entityType, entityId } = entityRef(raw);
  const version = raw.version ?? "v1";
  const provider = getStorageProvider();

  let created: { id: string } | undefined;
  let storedKey: string | undefined;
  try {
    // Placeholder key; updated once we know the id.
    created = await createDocumentWithFile(
      { ...parsed.data },
      { storageKey: "pending", storageProvider: process.env.STORAGE_PROVIDER ?? "local", mimeType: check.mime, sizeBytes: bytes.length, checksum: check.checksum, originalFilename: file.name },
      { type: "HUMAN", userId: vp.userId },
    );
    const key = buildObjectKey({ entityType, entityId, documentId: created.id, version, filename: file.name });
    await provider.put(key, bytes, check.mime);
    storedKey = key;
    await prisma.document.update({ where: { id: created.id }, data: { storageKey: key } });
  } catch (err) {
    if (storedKey) await provider.delete(storedKey).catch(() => {});
    if (created) await prisma.document.delete({ where: { id: created.id } }).catch(() => {});
    const status = err instanceof StorageError ? err.status : 502;
    return Response.json({ error: "Failed to store file" }, { status });
  }

  // Audit is best-effort and must not undo a committed upload.
  await logDocumentAccess(created.id, vp.userId ?? null, "UPLOAD").catch(() => {});
  return Response.json({ id: created.id }, { status: 201 });
}
