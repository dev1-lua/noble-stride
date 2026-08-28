// F3.2 (image7): the fund signs the Noblestride NDA in the portal, or uploads
// its own for sign-off. Against the real DB, because the point of the test is
// that all three routes land in the SAME investor state — the shared
// applyOpenNda() is what stops the click-wrap flow drifting away from what
// staff recording an NDA has always done.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/graphql/context";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

// A 1×1 transparent PNG — a real, tiny, valid signature payload.
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const UNIQ = `nda-${Date.now()}`;
const FUND = `zz-NDA Fund ${UNIQ}`;
const SIGNER_EMAIL = `zz-signer-${UNIQ}@zznda.test`;
const ACTOR: Actor = { type: "HUMAN" } as Actor;

let investorId: string;
let personId: string;

d("NDA click-wrap, own-upload and countersign (DB)", () => {
  beforeAll(async () => {
    const { prisma } = await import("@/lib/db");
    const investor = await prisma.investor.create({
      data: {
        name: FUND,
        investorType: "VentureCapital",
        ndaStatus: "None",
        contacts: {
          create: {
            firstName: "Nia",
            lastName: "Signatory",
            email: SIGNER_EMAIL,
            isPrimaryContact: true,
            portalRole: "Editor",
          },
        },
      },
      select: { id: true, contacts: { select: { id: true } } },
    });
    investorId = investor.id;
    personId = investor.contacts[0].id;
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.eSignEnvelope.deleteMany({ where: { investorId } });
    await prisma.document.deleteMany({ where: { investorId } });
    await prisma.activity.deleteMany({ where: { investorId } });
    await prisma.notification.deleteMany({ where: { investorId } });
    await prisma.person.deleteMany({ where: { investorId } });
    await prisma.investor.delete({ where: { id: investorId } });
  });

  it("refuses to sign without the authorised-signatory confirmation", async () => {
    const { signOpenNdaClickwrap } = await import("../nda");
    await expect(
      signOpenNdaClickwrap(
        {
          investorId,
          personId,
          signerName: "Nia Signatory",
          signerEmail: SIGNER_EMAIL,
          signatureImage: TINY_PNG,
          ip: "127.0.0.1",
          authorisedSignatory: false,
        },
        ACTOR,
      ),
    ).rejects.toThrow(/authorised signatory/i);
  });

  it("refuses a signature that is not a bounded PNG data URL", async () => {
    const { signOpenNdaClickwrap } = await import("../nda");
    await expect(
      signOpenNdaClickwrap(
        {
          investorId,
          personId,
          signerName: "Nia Signatory",
          signerEmail: SIGNER_EMAIL,
          signatureImage: "nope",
          ip: null,
          authorisedSignatory: true,
        },
        ACTOR,
      ),
    ).rejects.toThrow(/signature/i);
  });

  it("leaves the investor untouched when a signature is refused", async () => {
    const { prisma } = await import("@/lib/db");
    const investor = await prisma.investor.findUniqueOrThrow({ where: { id: investorId } });
    expect(investor.ndaStatus).toBe("None");
    expect(await prisma.eSignEnvelope.count({ where: { investorId } })).toBe(0);
  });

  it("records the envelope, the executed document and the Open NDA", async () => {
    const { prisma } = await import("@/lib/db");
    const { signOpenNdaClickwrap } = await import("../nda");
    const { NDA_TEMPLATE_VERSION } = await import("@/lib/nda/standard-nda");

    const out = await signOpenNdaClickwrap(
      {
        investorId,
        personId,
        signerName: "Nia Signatory",
        signerEmail: SIGNER_EMAIL,
        signatureImage: TINY_PNG,
        ip: "203.0.113.9",
        authorisedSignatory: true,
      },
      ACTOR,
    );

    const envelope = await prisma.eSignEnvelope.findUniqueOrThrow({ where: { id: out.envelopeId } });
    expect(envelope.provider).toBe("clickwrap");
    expect(envelope.kind).toBe("OpenNda");
    expect(envelope.status).toBe("completed");
    expect(envelope.templateVersion).toBe(NDA_TEMPLATE_VERSION);
    expect(envelope.signatureImage).toBe(TINY_PNG);
    expect(envelope.signedIp).toBe("203.0.113.9");
    expect(envelope.completedAt).not.toBeNull();

    const document = await prisma.document.findUniqueOrThrow({ where: { id: out.documentId } });
    expect(document.type).toBe("NDA");
    expect(document.status).toBe("Executed");
    expect(document.accessLevel).toBe("Internal");
    // The uploader is an external Person, never a staff User.
    expect(document.uploadedByPersonId).toBe(personId);
    expect(document.uploadedById).toBeNull();
    expect(document.name).toContain(NDA_TEMPLATE_VERSION);

    const investor = await prisma.investor.findUniqueOrThrow({ where: { id: investorId } });
    expect(investor.ndaStatus).toBe("OpenNDA");
    expect(investor.openNdaSignedAt).not.toBeNull();

    // The same Activity type recordOpenNda writes, so the timeline reads alike.
    const activity = await prisma.activity.findFirst({
      where: { investorId, type: "NDASigned" },
      orderBy: { createdAt: "desc" },
    });
    expect(activity?.subject).toContain("signed online");
  });

  it("re-signing is additive — the audit trail keeps both envelopes", async () => {
    const { prisma } = await import("@/lib/db");
    const { signOpenNdaClickwrap } = await import("../nda");
    await signOpenNdaClickwrap(
      {
        investorId,
        personId,
        signerName: "Nia Signatory",
        signerEmail: SIGNER_EMAIL,
        signatureImage: TINY_PNG,
        ip: null,
        authorisedSignatory: true,
      },
      ACTOR,
    );
    expect(await prisma.eSignEnvelope.count({ where: { investorId, provider: "clickwrap" } })).toBe(2);
  });

  it("puts an uploaded NDA forward, lists it, and countersigns it", async () => {
    const { prisma } = await import("@/lib/db");
    const { submitOwnNda, pendingNdaUploads, countersignUploadedNda } = await import("../nda");

    // What /api/portal/documents would have created.
    const uploaded = await prisma.document.create({
      data: {
        name: "zz-own-nda.pdf",
        type: "NDA",
        accessLevel: "Internal",
        status: "UnderReview",
        investorId,
        uploadedByPersonId: personId,
      },
      select: { id: true },
    });

    await submitOwnNda({ investorId, personId, documentId: uploaded.id }, ACTOR);

    const pending = await pendingNdaUploads(investorId);
    expect(pending.map((p) => p.id)).toContain(uploaded.id);
    expect(pending.find((p) => p.id === uploaded.id)?.uploadedByName).toBe("Nia Signatory");

    const result = await countersignUploadedNda(uploaded.id, ACTOR);
    expect(result.investorId).toBe(investorId);

    const envelope = await prisma.eSignEnvelope.findUniqueOrThrow({ where: { id: result.envelopeId } });
    expect(envelope.provider).toBe("upload");
    expect(envelope.externalId).toBe(`upload:${uploaded.id}`);
    expect(envelope.signerEmail).toBe(SIGNER_EMAIL);

    const document = await prisma.document.findUniqueOrThrow({ where: { id: uploaded.id } });
    expect(document.status).toBe("Executed");

    // Countersigned paper is no longer pending.
    expect((await pendingNdaUploads(investorId)).map((p) => p.id)).not.toContain(uploaded.id);

    const investor = await prisma.investor.findUniqueOrThrow({ where: { id: investorId } });
    expect(investor.ndaStatus).toBe("OpenNDA");
  });

  it("refuses to countersign a document that is not an NDA awaiting review", async () => {
    const { prisma } = await import("@/lib/db");
    const { countersignUploadedNda } = await import("../nda");
    const other = await prisma.document.create({
      data: { name: "zz-teaser.pdf", type: "Teaser", accessLevel: "Internal", investorId },
      select: { id: true },
    });
    await expect(countersignUploadedNda(other.id, ACTOR)).rejects.toThrow(/not an investor NDA/i);
  });

  it("an own-NDA submission never claims an NDA on its own", async () => {
    const { prisma } = await import("@/lib/db");
    const { submitOwnNda } = await import("../nda");
    const fresh = await prisma.investor.create({
      data: { name: `zz-Unsigned Fund ${UNIQ}`, investorType: "VentureCapital", ndaStatus: "None" },
      select: { id: true },
    });
    const doc = await prisma.document.create({
      data: { name: "zz-second.pdf", type: "NDA", accessLevel: "Internal", status: "Draft", investorId: fresh.id },
      select: { id: true },
    });
    await submitOwnNda({ investorId: fresh.id, personId, documentId: doc.id }, ACTOR);
    expect((await prisma.document.findUniqueOrThrow({ where: { id: doc.id } })).status).toBe("UnderReview");
    expect((await prisma.investor.findUniqueOrThrow({ where: { id: fresh.id } })).ndaStatus).toBe("None");

    await prisma.activity.deleteMany({ where: { investorId: fresh.id } });
    await prisma.document.deleteMany({ where: { investorId: fresh.id } });
    await prisma.investor.delete({ where: { id: fresh.id } });
  });

  it("refuses a document that belongs to another fund", async () => {
    const { prisma } = await import("@/lib/db");
    const { submitOwnNda } = await import("../nda");
    const stranger = await prisma.investor.create({
      data: { name: `zz-Stranger Fund ${UNIQ}`, investorType: "VentureCapital", ndaStatus: "None" },
      select: { id: true },
    });
    const doc = await prisma.document.create({
      data: { name: "zz-theirs.pdf", type: "NDA", accessLevel: "Internal", status: "UnderReview", investorId: stranger.id },
      select: { id: true },
    });
    await expect(submitOwnNda({ investorId, personId, documentId: doc.id }, ACTOR)).rejects.toThrow(/not on file/i);
    await prisma.document.delete({ where: { id: doc.id } });
    await prisma.investor.delete({ where: { id: stranger.id } });
  });
});
