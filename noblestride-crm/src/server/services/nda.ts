// NDA service — records NDAs manually (SOW §06: no automatic signing).
// Open NDA lives on the investor; Closed NDA lives on one engagement.
//
// F3.2 (image7) adds three self-service routes to the SAME end state:
//   * signOpenNdaClickwrap  — the fund reads the Noblestride NDA in the portal
//     and signs it there (drawn/typed/uploaded signature).
//   * submitOwnNda          — the fund uploads its own paper for sign-off.
//   * countersignUploadedNda— staff accept that paper.
// All three funnel through the private applyOpenNda() so the investor record
// ends up exactly where recordOpenNda would have put it. That is deliberate:
// three doors, one lock, no chance of the flows drifting apart.

import { randomUUID } from "node:crypto";
import type { Engagement, Investor, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { actorSource, CrudError } from "./crud";
import { notify, notifyInvestors, adminUserIds } from "./notifications";
import { NDA_TEMPLATE_VERSION, isSignatureDataUrl } from "@/lib/nda/standard-nda";
import type { Actor } from "@/graphql/context";

/**
 * The one place an Open NDA is applied to an investor: flip ndaStatus, stamp
 * openNdaSignedAt, and log the Activity. Called inside the caller's
 * transaction so a signature and its consequence commit together.
 */
async function applyOpenNda(
  tx: Prisma.TransactionClient,
  investorId: string,
  actor: Actor,
  subject: (investorName: string) => string,
): Promise<Investor> {
  const investor = await tx.investor.update({
    where: { id: investorId },
    data: { ndaStatus: "OpenNDA", openNdaSignedAt: new Date() },
  });
  await tx.activity.create({
    data: {
      type: "NDASigned",
      subject: subject(investor.name),
      investorId,
      createdSource: actorSource(actor),
    },
  });
  return investor;
}

export async function recordOpenNda(investorId: string, actor: Actor): Promise<Investor> {
  return prisma.$transaction((tx) =>
    applyOpenNda(tx, investorId, actor, (name) => `Open NDA recorded — ${name}`),
  );
}

export async function recordClosedNda(engagementId: string, actor: Actor): Promise<Engagement> {
  return prisma.$transaction(async (tx) => {
    const engagement = await tx.engagement.update({
      where: { id: engagementId },
      data: { ndaType: "Closed", ndaSignedAt: new Date() },
      include: { investor: true },
    });
    if (engagement.investor.ndaStatus === "None") {
      await tx.investor.update({
        where: { id: engagement.investorId },
        data: { ndaStatus: "ClosedNDA" },
      });
    }
    await tx.activity.create({
      data: {
        type: "NDASigned",
        subject: `Closed NDA recorded — ${engagement.name}`,
        engagementId,
        investorId: engagement.investorId,
        transactionId: engagement.transactionId,
        createdSource: actorSource(actor),
      },
    });
    return engagement;
  });
}

// ── F3.2 self-service NDA routes ────────────────────────────────────────────

export interface ClickwrapInput {
  investorId: string;
  personId: string;
  signerName: string;
  signerEmail: string;
  signatureImage: string;
  ip: string | null;
  authorisedSignatory: boolean;
}

/**
 * Click-wrap signature of the standard Noblestride NDA from the investor
 * portal. Writes the evidence (an ESignEnvelope carrying the template version,
 * the signer's IP and the signature image) and an Executed NDA Document, then
 * applies the Open NDA exactly as staff recording it would.
 *
 * Re-signing is allowed and additive: a new envelope and a new document are
 * created and the old rows stay. The table is an audit trail, not a cache.
 */
export async function signOpenNdaClickwrap(
  input: ClickwrapInput,
  actor: Actor,
): Promise<{ envelopeId: string; documentId: string }> {
  if (!input.authorisedSignatory) {
    throw new CrudError("Confirm that you are an authorised signatory before signing.");
  }
  if (!isSignatureDataUrl(input.signatureImage)) {
    throw new CrudError("Add your signature before signing.");
  }
  const signerName = input.signerName.trim();
  if (signerName.length < 2) throw new CrudError("Enter the full name of the signatory.");

  const now = new Date();
  const source = actorSource(actor);

  const result = await prisma.$transaction(async (tx) => {
    const investor = await applyOpenNda(
      tx,
      input.investorId,
      actor,
      (name) => `Open NDA signed online — ${name}`,
    );

    const envelope = await tx.eSignEnvelope.create({
      data: {
        provider: "clickwrap",
        // externalId is NOT NULL and unique per provider; there is no external
        // system here, so the id is ours.
        externalId: `clickwrap:${randomUUID()}`,
        kind: "OpenNda",
        status: "completed",
        signerEmail: input.signerEmail,
        signerName,
        templateVersion: NDA_TEMPLATE_VERSION,
        signedIp: input.ip,
        signatureImage: input.signatureImage,
        investorId: input.investorId,
        completedAt: now,
        createdSource: source,
      },
      select: { id: true },
    });

    // No file bytes are stored: the executed agreement is reproducible from
    // renderStandardNda(templateVersion) plus the envelope's signature image,
    // which is why the template module is pure and versioned.
    const document = await tx.document.create({
      data: {
        name: `Open NDA — ${investor.name} (${NDA_TEMPLATE_VERSION})`,
        type: "NDA",
        accessLevel: "Internal",
        status: "Executed",
        investorId: input.investorId,
        uploadedByPersonId: input.personId,
        createdSource: source,
      },
      select: { id: true },
    });

    return { envelopeId: envelope.id, documentId: document.id, investorName: investor.name };
  });

  await notify(await adminUserIds(), {
    kind: "nda_signed",
    title: `Open NDA signed — ${result.investorName}`,
    href: `/investors/${input.investorId}#nda`,
  }).catch((err) => console.error("[nda] clickwrap notification failed:", err));

  return { envelopeId: result.envelopeId, documentId: result.documentId };
}

/**
 * The fund uploaded its own NDA paper (through /api/portal/documents, which
 * files it UnderReview and notifies staff). This records that the upload is
 * being put forward for sign-off.
 *
 * It deliberately does NOT touch Investor.ndaStatus — an unsigned upload is not
 * an NDA — and deliberately does NOT notify again: the upload route already
 * raised one `nda_uploaded` bell for this document, and two entries for one
 * action would be noise.
 */
export async function submitOwnNda(
  input: { investorId: string; personId: string; documentId: string },
  actor: Actor,
): Promise<void> {
  const document = await prisma.document.findFirst({
    where: { id: input.documentId, investorId: input.investorId, type: "NDA" },
    select: { id: true, name: true, status: true },
  });
  if (!document) throw new CrudError("That document is not on file for your fund.");
  if (document.status === "Executed") return; // already countersigned; nothing to submit

  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: document.id }, data: { status: "UnderReview" } });
    await tx.activity.create({
      data: {
        type: "Note",
        subject: `NDA submitted for sign-off — ${document.name}`,
        investorId: input.investorId,
        createdSource: actorSource(actor),
      },
    });
  });
}

/** NDA documents a fund has put forward and staff have not yet countersigned. */
export async function pendingNdaUploads(
  investorId: string,
): Promise<{ id: string; name: string; uploadedAt: Date; uploadedByName: string | null }[]> {
  const rows = await prisma.document.findMany({
    where: { investorId, type: "NDA", status: "UnderReview" },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      name: true,
      uploadedAt: true,
      uploadedByPerson: { select: { firstName: true, lastName: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    uploadedAt: r.uploadedAt,
    uploadedByName: r.uploadedByPerson
      ? `${r.uploadedByPerson.firstName} ${r.uploadedByPerson.lastName ?? ""}`.trim()
      : null,
  }));
}

/**
 * Staff accept a fund's own NDA paper. The document becomes Executed, an
 * envelope records who signed it, and the investor's Open NDA is applied
 * through the same path as every other route.
 */
export async function countersignUploadedNda(
  documentId: string,
  actor: Actor,
): Promise<{ investorId: string; envelopeId: string }> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      investorId: true,
      uploadedByPerson: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  if (!document || document.type !== "NDA" || !document.investorId) {
    throw new CrudError("That document is not an investor NDA.");
  }
  if (document.status !== "UnderReview") {
    throw new CrudError("Only an NDA awaiting review can be countersigned.");
  }
  const investorId = document.investorId;
  const signer = document.uploadedByPerson;

  const result = await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: document.id }, data: { status: "Executed" } });
    const envelope = await tx.eSignEnvelope.create({
      data: {
        provider: "upload",
        externalId: `upload:${document.id}`,
        kind: "OpenNda",
        status: "completed",
        signerEmail: signer?.email ?? "",
        signerName: signer ? `${signer.firstName} ${signer.lastName ?? ""}`.trim() : "Uploaded NDA",
        investorId,
        completedAt: new Date(),
        createdSource: actorSource(actor),
      },
      select: { id: true },
    });
    await applyOpenNda(tx, investorId, actor, (name) => `Uploaded NDA countersigned — ${name}`);
    return { envelopeId: envelope.id };
  });

  await notifyInvestors([investorId], {
    kind: "nda_signed",
    title: "Your NDA has been countersigned",
    href: "/portal/investor/nda",
  }).catch((err) => console.error("[nda] countersign notification failed:", err));

  return { investorId, envelopeId: result.envelopeId };
}

/**
 * Staff ask a fund to sign the standard NDA. Deliberately uses the existing
 * `document_shared` kind: `nda_signed`/`nda_uploaded` are reserved for actual
 * signature and upload events, so the bell copy stays truthful.
 */
export async function requestNdaSignature(investorId: string, actor: Actor): Promise<Investor> {
  const investor = await prisma.investor.findUnique({ where: { id: investorId }, select: { id: true, name: true } });
  if (!investor) throw new CrudError("Investor not found.");

  await prisma.activity.create({
    data: {
      type: "Note",
      subject: `Standard NDA requested — ${investor.name}`,
      investorId,
      createdSource: actorSource(actor),
    },
  });

  await notifyInvestors([investorId], {
    kind: "document_shared",
    title: "Please sign the Noblestride NDA",
    href: "/portal/investor/nda",
  }).catch((err) => console.error("[nda] request notification failed:", err));

  return prisma.investor.findUniqueOrThrow({ where: { id: investorId } });
}
