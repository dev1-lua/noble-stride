// src/server/services/docshare.ts
// Thin service: share a document via the docshare provider seam (Box) and
// persist the returned Box fields onto the Document row.
import { prisma } from "@/lib/db";
import { getDocShareProvider } from "@/server/integrations/docshare/provider";
import { notifyInvestors } from "./notifications";

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
  const doc = await prisma.document.update({
    where: { id: documentId },
    data: {
      boxFileId: result.externalFileId,
      boxSharedLinkUrl: result.sharedUrl,
      boxWatermarkApplied: result.watermarkApplied,
    },
    select: { name: true, investorId: true, transactionId: true },
  });
  // Portal feed (client feedback 2026-07): only when the document is filed
  // against a specific investor — a generic deal-level share has no single
  // portal recipient. Best-effort; the share itself already succeeded.
  if (doc.investorId) {
    await notifyInvestors([doc.investorId], {
      kind: "document_shared",
      title: `Document shared with you: ${doc.name}`,
      href: doc.transactionId ? `/portal/investor/deals/${doc.transactionId}` : "/portal/investor",
    });
  }
  return { sharedUrl: result.sharedUrl };
}
