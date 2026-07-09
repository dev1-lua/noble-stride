// Download authorization — reuses the visibility engine instead of
// duplicating tier/NDA/VDR gating. An investor may download a document iff
// the engine already projects it to them (membership-by-projected-id).

import type { PrismaClient } from "@prisma/client";
import type { Viewpoint } from "@/lib/viewpoint";
import { loadInvestorPortalData, loadInvestorPipeline } from "@/server/visibility";

/** Pure: given the already-projected set of doc ids visible to an investor
 *  viewpoint, decide whether a viewpoint may download a given document. */
export function isDocDownloadable(
  viewpoint: Viewpoint,
  doc: { id: string; partnerId: string | null },
  investorVisibleDocIds: Set<string>,
): boolean {
  if (viewpoint.role === "admin") return true; // internal staff
  if (viewpoint.role === "investor") return investorVisibleDocIds.has(doc.id);
  if (viewpoint.role === "partner") return doc.partnerId != null && doc.partnerId === viewpoint.recordId;
  return false;
}

/** Loads the document and (for investors) the visibility-engine's projected
 *  doc-id set, then defers to the pure helper above. */
export async function canDownloadDocument(
  prisma: PrismaClient,
  viewpoint: Viewpoint,
  documentId: string,
): Promise<boolean> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, partnerId: true },
  });
  if (!doc) return false;

  let visibleIds = new Set<string>();
  if (viewpoint.role === "investor" && viewpoint.recordId) {
    const [portal, pipeline] = await Promise.all([
      loadInvestorPortalData(prisma, viewpoint.recordId),
      loadInvestorPipeline(prisma, viewpoint.recordId),
    ]);
    visibleIds = new Set<string>([
      ...portal.deals.flatMap((d) => d.documents.map((document) => document.id)),
      ...pipeline.flatMap((item) => item.deal.documents.map((document) => document.id)),
    ]);
  }
  return isDocDownloadable(viewpoint, doc, visibleIds);
}
