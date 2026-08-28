// Applicant document upload (F2.4 / §2b G1: "client access to the portal … for
// submission of the documents").
//
// The caller is an anonymous applicant holding a 30-minute OTP cookie, not a
// staff session, so this route is deliberately narrower than the staff upload
// route in every dimension:
//
//  * the target client is re-derived from the applicant's own applications —
//    the posted clientId is never trusted, only matched;
//  * three file types (PDF / Word / Excel) and a 15 MB ceiling, rather than the
//    shared 50 MB and the full allow-list;
//  * every document lands `UnderReview` and `Internal`, so nothing an applicant
//    uploads is visible to investors;
//  * `uploadedByPersonId` records the external Person, so the audit trail does
//    not imply a staff member filed it.
//
// It lives at /apply/status/upload rather than under /api specifically so it
// falls INSIDE the applicant cookie's path. That cookie is scoped to
// /apply/status, which means it is never sent to any other part of the app —
// widening the path to reach an /api route would have traded a real security
// property for a tidier URL.

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  verifyApplicantToken,
  listApplicationsForEmail,
  APPLICANT_SESSION_COOKIE,
} from "@/server/services/applicant-status";
import { rateLimit } from "@/server/auth/rate-limit";
import { validateUpload } from "@/server/storage/validation";
import { getStorageProvider, StorageError } from "@/server/storage/provider";
import { buildObjectKey } from "@/server/storage/keys";
import { createDocumentWithFile, logDocumentAccess } from "@/server/services/documents";
import { notify, adminUserIds } from "@/server/services/notifications";
import { normalizeEmail } from "@/server/auth/guardrails";

export const runtime = "nodejs";

const APPLICANT_MAX_BYTES = 15 * 1024 * 1024;
const APPLICANT_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export async function POST(request: Request): Promise<Response> {
  const token = (await cookies()).get(APPLICANT_SESSION_COOKIE)?.value;
  const session = token ? await verifyApplicantToken(token) : null;
  if (!session) return Response.json({ error: "Your tracking session expired." }, { status: 401 });

  if (!rateLimit(`applicant-upload:${session.email}`, { max: 10, windowMs: 60 * 60 * 1000 })) {
    return Response.json({ error: "Too many uploads — try again later." }, { status: 429 });
  }

  // Check the declared size BEFORE reading the body: Next truncates an
  // over-limit body and then fails to parse the multipart payload, which would
  // surface as an opaque 500 instead of a usable message.
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > APPLICANT_MAX_BYTES) {
    return Response.json({ error: "That file is too large. The limit is 15 MB." }, { status: 413 });
  }

  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return Response.json({ error: "That file is too large. The limit is 15 MB." }, { status: 413 });
  }
  const file = fd.get("file");
  const clientId = fd.get("clientId");
  if (!(file instanceof File)) return Response.json({ error: "Missing file" }, { status: 400 });
  if (typeof clientId !== "string" || !clientId) {
    return Response.json({ error: "Missing application" }, { status: 400 });
  }

  // Re-authorise against the applicant's own applications. A posted clientId is
  // an untrusted input: without this an applicant could file documents against
  // any company in the CRM.
  const applications = await listApplicationsForEmail(session.email);
  const target = applications.find((a) => a.clientId === clientId);
  if (!target) return Response.json({ error: "Not your application" }, { status: 403 });

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > APPLICANT_MAX_BYTES) {
    return Response.json({ error: "That file is too large. The limit is 15 MB." }, { status: 400 });
  }
  if (!APPLICANT_MIMES.has(file.type)) {
    return Response.json({ error: "Please upload a PDF, Word or Excel file." }, { status: 400 });
  }
  const check = validateUpload(file.name, file.type, bytes);
  if (!check.ok) return Response.json({ error: check.reason }, { status: 400 });

  const person = await prisma.person.findFirst({
    where: { clientId, email: { equals: normalizeEmail(session.email), mode: "insensitive" } },
    select: { id: true },
  });

  const provider = getStorageProvider();
  let created: { id: string } | undefined;
  let storedKey: string | undefined;
  try {
    created = await createDocumentWithFile(
      {
        name: file.name,
        type: "Other",
        accessLevel: "Internal",
        status: "UnderReview",
        clientId,
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
      entityType: "client",
      entityId: clientId,
      documentId: created.id,
      version: "v1",
      filename: file.name,
    });
    await provider.put(key, bytes, check.mime);
    storedKey = key;
    await prisma.document.update({
      where: { id: created.id },
      data: { storageKey: key, uploadedByPersonId: person?.id ?? null },
    });
  } catch (err) {
    // Same compensating cleanup as the staff route: never leave a row pointing
    // at bytes that are not there, or bytes with no row.
    if (storedKey) await provider.delete(storedKey).catch(() => {});
    if (created) await prisma.document.delete({ where: { id: created.id } }).catch(() => {});
    const status = err instanceof StorageError ? err.status : 502;
    return Response.json({ error: "We couldn't save that file. Please try again." }, { status });
  }

  await logDocumentAccess(created.id, null, "UPLOAD").catch(() => {});
  // Best-effort: the upload is committed, so a notification failure must not
  // turn into an error for the applicant.
  try {
    await notify(await adminUserIds(), {
      kind: "applicant_document_uploaded",
      title: `Applicant uploaded a document — ${target.company}`,
      body: file.name,
      href: "/applications",
    });
  } catch (err) {
    console.error("[apply/documents] admin notification failed:", err);
  }

  return Response.json({ id: created.id }, { status: 201 });
}
