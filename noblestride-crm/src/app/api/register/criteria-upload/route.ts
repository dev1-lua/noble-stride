// One-shot investment-criteria upload for a fund that has just registered
// (F3.1 / image5).
//
// The caller has no session — their account is PENDING approval — so authority
// comes entirely from the 15-minute `reg_upload` cookie minted by
// registerWizardAction, which names exactly one investor. Two consequences
// worth stating:
//
//  * the investor id is read from the token, never from the request body;
//  * the cookie is cleared on EVERY outcome and the route refuses a second
//    criteria document, so a replayed token cannot be used to spam uploads.

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  verifyCriteriaUploadToken,
  REG_UPLOAD_COOKIE,
  CRITERIA_MAX_BYTES,
  CRITERIA_MIMES,
} from "@/server/onboarding/criteria-upload-token";
import { validateUpload } from "@/server/storage/validation";
import { getStorageProvider, StorageError } from "@/server/storage/provider";
import { buildObjectKey } from "@/server/storage/keys";
import { createDocumentWithFile, logDocumentAccess } from "@/server/services/documents";
import { notify, adminUserIds } from "@/server/services/notifications";

export const runtime = "nodejs";

const TOO_LARGE = "That file is too large. The limit is 15 MB.";
const WRONG_TYPE = "Please upload a PDF, Word or Excel file.";

async function clearCookie(): Promise<void> {
  (await cookies()).delete(REG_UPLOAD_COOKIE);
}

export async function POST(request: Request): Promise<Response> {
  const token = (await cookies()).get(REG_UPLOAD_COOKIE)?.value;
  const claims = token ? await verifyCriteriaUploadToken(token) : null;
  if (!claims) {
    return Response.json({ error: "This upload link has expired. You can send the file later." }, { status: 401 });
  }
  const { investorId } = claims;

  // Size first: an over-limit body is truncated by the platform and then fails
  // to parse, which would surface as an opaque 500 rather than a message.
  if (Number(request.headers.get("content-length") ?? "0") > CRITERIA_MAX_BYTES) {
    await clearCookie();
    return Response.json({ error: TOO_LARGE }, { status: 413 });
  }

  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    await clearCookie();
    return Response.json({ error: TOO_LARGE }, { status: 413 });
  }
  const file = fd.get("file");
  if (!(file instanceof File)) {
    await clearCookie();
    return Response.json({ error: "Missing file" }, { status: 400 });
  }
  if (!CRITERIA_MIMES.includes(file.type)) {
    await clearCookie();
    return Response.json({ error: WRONG_TYPE }, { status: 400 });
  }

  const investor = await prisma.investor.findUnique({
    where: { id: investorId },
    select: { id: true, name: true },
  });
  if (!investor) {
    await clearCookie();
    return Response.json({ error: "Registration not found." }, { status: 404 });
  }

  // One criteria document per registration: a replayed token gets nothing.
  const existing = await prisma.document.count({
    where: { investorId, type: "InvestmentCriteria", isCurrent: true },
  });
  if (existing > 0) {
    await clearCookie();
    return Response.json({ error: "Criteria already received — thank you." }, { status: 409 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > CRITERIA_MAX_BYTES) {
    await clearCookie();
    return Response.json({ error: TOO_LARGE }, { status: 413 });
  }
  const check = validateUpload(file.name, file.type, bytes);
  if (!check.ok) {
    await clearCookie();
    return Response.json({ error: check.reason }, { status: 400 });
  }

  const provider = getStorageProvider();
  let created: { id: string } | undefined;
  let storedKey: string | undefined;
  try {
    created = await createDocumentWithFile(
      {
        name: file.name,
        type: "InvestmentCriteria",
        accessLevel: "Internal",
        status: "UnderReview",
        investorId,
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
      entityId: investorId,
      documentId: created.id,
      version: "v1",
      filename: file.name,
    });
    await provider.put(key, bytes, check.mime);
    storedKey = key;
    await prisma.document.update({ where: { id: created.id }, data: { storageKey: key } });
  } catch (err) {
    if (storedKey) await provider.delete(storedKey).catch(() => {});
    if (created) await prisma.document.delete({ where: { id: created.id } }).catch(() => {});
    await clearCookie();
    const status = err instanceof StorageError ? err.status : 502;
    return Response.json({ error: "We couldn't save that file. You can send it later." }, { status });
  }

  await clearCookie();
  await logDocumentAccess(created.id, null, "UPLOAD").catch(() => {});
  try {
    await notify(await adminUserIds(), {
      kind: "criteria_uploaded",
      title: `Investment criteria uploaded — ${investor.name}`,
      body: file.name,
      href: `/investors/${investorId}#documents`,
    });
  } catch (err) {
    console.error("[criteria-upload] admin notification failed:", err);
  }

  return Response.json({ id: created.id }, { status: 201 });
}
