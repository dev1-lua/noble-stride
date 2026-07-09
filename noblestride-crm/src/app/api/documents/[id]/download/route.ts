import { Readable } from "node:stream";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { canDownloadDocument } from "@/server/documents/authz";
import { getStorageProvider, StorageError } from "@/server/storage/provider";
import { logDocumentAccess } from "@/server/services/documents";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const vp = await getViewpoint();
  if (!vp) return Response.json({ error: "Not authenticated" }, { status: 401 });

  if (!(await canDownloadDocument(prisma, vp, id))) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, storageKey: true, mimeType: true, originalFilename: true },
  });
  if (!doc || !doc.storageKey) return Response.json({ error: "No stored file" }, { status: 404 });

  let object;
  try {
    object = await getStorageProvider().get(doc.storageKey);
  } catch (err) {
    const status = err instanceof StorageError ? err.status : 502;
    return Response.json({ error: "Storage error" }, { status });
  }

  await logDocumentAccess(doc.id, vp.userId ?? null, "DOWNLOAD");

  const filename = (doc.originalFilename ?? "document").replace(/"/g, "");
  const headers: Record<string, string> = {
    "content-type": doc.mimeType ?? object.contentType,
    "content-disposition": `attachment; filename="${filename}"`,
  };
  if (object.size > 0) headers["content-length"] = String(object.size);
  return new Response(Readable.toWeb(object.stream) as unknown as ReadableStream, {
    status: 200,
    headers,
  });
}
