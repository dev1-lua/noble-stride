// Express-interest smoke test (DB-backed, same fixture pattern as
// src/server/onboarding/__tests__/nda-services.smoke.test.ts).
// Locks the admin-facing EOI semantics: engagement created at Shared with
// status Interested, the investor's message persisted on the activity, and
// a repeat EOI never downgrades a status an admin has already progressed.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";

const UNIQ = `eoi-smoke-${Date.now()}`;
let investorId: string, txnId: string;

// The server action reads the viewpoint cookie and redirects; both are
// Next-runtime concerns, mocked so the DB semantics can run under vitest.
vi.mock("@/server/viewpoint", () => ({
  getViewpoint: async () => ({ role: "investor", recordId: investorId }),
}));
vi.mock("next/navigation", () => ({
  redirect: () => undefined,
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import { expressInterest } from "../actions";

function eoiForm(dealId: string, message: string): FormData {
  const fd = new FormData();
  fd.set("dealId", dealId);
  fd.set("message", message);
  return fd;
}

beforeAll(async () => {
  // Approved + Active investor with no criteria — discovers every active deal.
  const investor = await prisma.investor.create({
    data: { name: `Fund ${UNIQ}`, investorType: "PrivateEquity", onboardingStatus: "Approved" },
  });
  const client = await prisma.client.create({ data: { name: `Client ${UNIQ}` } });
  const txn = await prisma.transaction.create({ data: { name: `Deal ${UNIQ}`, clientId: client.id } });
  investorId = investor.id;
  txnId = txn.id;
});

afterAll(async () => {
  await prisma.activity.deleteMany({ where: { investorId } });
  await prisma.engagement.deleteMany({ where: { investorId } });
  await prisma.transaction.deleteMany({ where: { name: { contains: UNIQ } } });
  await prisma.client.deleteMany({ where: { name: { contains: UNIQ } } });
  await prisma.investor.deleteMany({ where: { id: investorId } });
});

describe("expressInterest", () => {
  it("creates the engagement at Shared with status Interested and persists the message", async () => {
    await expressInterest(eoiForm(txnId, "Keen to see the IM."));

    const eng = await prisma.engagement.findUniqueOrThrow({
      where: { transactionId_investorId: { transactionId: txnId, investorId } },
    });
    expect(eng.engagementStage).toBe("Shared");
    expect(eng.status).toBe("Interested");
    // Internal name carries the REAL deal name, never the teaser codename.
    expect(eng.name).toContain(`Deal ${UNIQ}`);

    const note = await prisma.activity.findFirst({
      where: { engagementId: eng.id, subject: { contains: "expressed interest" } },
    });
    expect(note?.body).toBe("Keen to see the IM.");
  });

  it("repeat EOI never downgrades an admin-progressed status", async () => {
    await prisma.engagement.update({
      where: { transactionId_investorId: { transactionId: txnId, investorId } },
      data: { status: "Committed" },
    });
    await expressInterest(eoiForm(txnId, "Checking in again."));
    const eng = await prisma.engagement.findUniqueOrThrow({
      where: { transactionId_investorId: { transactionId: txnId, investorId } },
    });
    expect(eng.status).toBe("Committed");
  });

  it("repeat EOI re-flags early-contact statuses as Interested", async () => {
    await prisma.engagement.update({
      where: { transactionId_investorId: { transactionId: txnId, investorId } },
      data: { status: "Contacted" },
    });
    await expressInterest(eoiForm(txnId, ""));
    const eng = await prisma.engagement.findUniqueOrThrow({
      where: { transactionId_investorId: { transactionId: txnId, investorId } },
    });
    expect(eng.status).toBe("Interested");
  });
});
