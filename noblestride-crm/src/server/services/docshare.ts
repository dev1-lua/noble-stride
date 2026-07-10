// src/server/services/docshare.ts
// Thin service: share a document via the docshare provider seam (Box) and
// persist the returned Box fields onto the Document row.
import { prisma } from "@/lib/db";
import { getDocShareProvider } from "@/server/integrations/docshare/provider";

export async function shareDocumentViaBox(
  documentId: string,
  bytes: Buffer,
  opts: { filename: string; contentType: string; watermark?: boolean; password?: string; expiresAt?: Date; allowDownload?: boolean },
): Promise<{ sharedUrl: string }> {
  const result = await getDocShareProvider().shareDocument({
    documentId,
    bytes,
    filename: opts.filename,
    contentType: opts.contentType,
    watermark: opts.watermark ?? true,
    password: opts.password,
    expiresAt: opts.expiresAt,
    allowDownload: opts.allowDownload ?? false,
  });
  await prisma.document.update({
    where: { id: documentId },
    data: {
      boxFileId: result.externalFileId,
      boxSharedLinkUrl: result.sharedUrl,
      boxWatermarkApplied: result.watermarkApplied,
    },
  });
  return { sharedUrl: result.sharedUrl };
}
