// Authenticated portal upload (F3.1 criteria, F3.2 own NDA).
//
// Used by the investor portal's Documents card and, in Task 10, by the NDA card.
// Narrow by design: two document types, three file types, 15 MB, everything
// filed Internal/UnderReview so nothing an investor uploads becomes visible to
// anyone else before staff look at it.
//
// Note it calls getPortalMembership rather than requirePortalEditor: the latter
// redirects, and a redirect from a fetch() is a confusing 200-with-HTML rather
// than a refusal. Route handlers answer with a status code.

import { prisma } from "@/lib/db";
import { getPortalMembership } from "@/server/auth/portal-authz";
import { validateUpload } from "@/server/storage/validation";
import { getStorageProvider, StorageError } from "@/server/storage/provider";
import { buildObjectKey } from "@/server/storage/keys";
import { createDocumentWithFile, logDocumentAccess } from "@/server/services/documents";
import { notify, adminUserIds } from "@/server/services/notifications";
import { CRITERIA_MAX_BYTES, CRITERIA_MIMES } from "@/server/onboarding/criteria-upload-token";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["InvestmentCriteria", "NDA"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

const NOTIFY_KIND: Record<AllowedType, "criteria_uploaded" | "nda_uploaded"> = {
  InvestmentCriteria: "criteria_uploaded",
  NDA: "nda_uploaded",
};

const TOO_LARGE = "That file is too large. The limit is 15 MB.";

export async function POST(request: Request): Promise<Response> {
  const member = await getPortalMembership();
  if (!member) return Response.json({ error: "Not signed in." }, { status: 401 });
  if (member.portalRole !== "Editor") {
    return Response.json({ error: "Your access is view-only." }, { status: 403 });
  }

  if (Number(request.headers.get("content-length") ?? "0") > CRITERIA_MAX_BYTES) {
    return Response.json({ error: TOO_LARGE }, { status: 413 });
  }

  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return Response.json({ error: TOO_LARGE }, { status: 413 });
  }

  const file = fd.get("file");
  const typeRaw = String(fd.get("type") ?? "");
  if (!(file instanceof File)) return Response.json({ error: "Missing file" }, { status: 400 });
  if (!(ALLOWED_TYPES as readonly string[]).includes(typeRaw)) {
    return Response.json({ error: "That document type can't be uploaded here." }, { status: 400 });
  }
  const type = typeRaw as AllowedType;

  if (!CRITERIA_MIMES.includes(file.type)) {
    return Response.json({ error: "Please upload a PDF, Word or Excel file." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > CRITERIA_MAX_BYTES) return Response.json({ error: TOO_LARGE }, { status: 413 });
  const check = validateUpload(file.name, file.type, bytes);
  if (!check.ok) return Response.json({ error: check.reason }, { status: 400 });

  const investor = await prisma.investor.findUnique({
    where: { id: member.investorId },
    select: { name: true },
  });

  const provider = getStorageProvider();
  let created: { id: string } | undefined;
  let storedKey: string | undefined;
  try {
    created = await createDocumentWithFile(
      {
        name: file.name,
        type,
        accessLevel: "Internal",
        status: "UnderReview",
        investorId: member.investorId,
      },
      {
        storageKey: "pending",
        storageProvider: process.env.STORAGE_PROVIDER ?? "local",
        mimeType: check.mime,
        sizeBytes: bytes.length,
        checksum: check.checksum,
        originalFilename: file.name,
      },
      { type: "HUMAN" },
    );
    const key = buildObjectKey({
      entityType: "investor",
      entityId: member.investorId,
      documentId: created.id,
      version: "v1",
      filename: file.name,
    });
    await provider.put(key, bytes, check.mime);
    storedKey = key;
    await prisma.document.update({
      where: { id: created.id },
      // The uploader is an external Person, not a staff User.
      data: { storageKey: key, uploadedByPersonId: member.personId },
    });
  } catch (err) {
    if (storedKey) await provider.delete(storedKey).catch(() => {});
    if (created) await prisma.document.delete({ where: { id: created.id } }).catch(() => {});
    const status = err instanceof StorageError ? err.status : 502;
    return Response.json({ error: "We couldn't save that file. Please try again." }, { status });
  }

  await logDocumentAccess(created.id, null, "UPLOAD").catch(() => {});
  try {
    await notify(await adminUserIds(), {
      kind: NOTIFY_KIND[type],
      title:
        type === "NDA"
          ? `NDA uploaded for review — ${investor?.name ?? "investor"}`
          : `Investment criteria uploaded — ${investor?.name ?? "investor"}`,
      body: file.name,
      href: `/investors/${member.investorId}#documents`,
    });
  } catch (err) {
    console.error("[portal/documents] admin notification failed:", err);
  }

  return Response.json({ id: created.id }, { status: 201 });
}
