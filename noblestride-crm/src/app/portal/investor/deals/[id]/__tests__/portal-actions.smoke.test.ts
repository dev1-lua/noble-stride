// Next-step + decline smoke tests (DB-backed) — same mock scaffolding as
// express-interest.smoke.test.ts. Locks: requests never mutate the stage;
// decline mutates it directly (access-reducing) with a StageChange record.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";

const UNIQ = `portal-act-${Date.now()}`;
let investorId: string, txnId: string;

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
// requestNextStep/declineDeal now call headers() to rate-limit by IP; outside
// a real request scope next/headers has no context to read, so it's mocked
// here the same way the invite-flow smoke tests would need to.
vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-for", "127.0.0.1"]]),
}));

import { declineDeal, expressInterest, requestNextStep } from "../actions";

function form(dealId: string): FormData {
  const fd = new FormData();
  fd.set("dealId", dealId);
  return fd;
}

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

beforeAll(async () => {
  if (!hasDb) return;
  const investor = await prisma.investor.create({
    data: { name: `Fund ${UNIQ}`, investorType: "PrivateEquity", onboardingStatus: "Approved" },
  });
  const client = await prisma.client.create({ data: { name: `Client ${UNIQ}` } });
  const txn = await prisma.transaction.create({ data: { name: `Deal ${UNIQ}`, clientId: client.id } });
  investorId = investor.id;
  txnId = txn.id;
  await expressInterest(form(txnId)); // engagement exists at Shared/Interested
});

afterAll(async () => {
  if (!hasDb) return;
  await prisma.stageChange.deleteMany({ where: { investorId } });
  await prisma.activity.deleteMany({ where: { investorId } });
  await prisma.engagement.deleteMany({ where: { investorId } });
  await prisma.transaction.deleteMany({ where: { name: { contains: UNIQ } } });
  await prisma.client.deleteMany({ where: { name: { contains: UNIQ } } });
  await prisma.investor.deleteMany({ where: { id: investorId } });
});

d("requestNextStep", () => {
  it("logs the stage-appropriate request WITHOUT touching the stage", async () => {
    await requestNextStep(form(txnId));
    const eng = await prisma.engagement.findUniqueOrThrow({
      where: { transactionId_investorId: { transactionId: txnId, investorId } },
    });
    expect(eng.engagementStage).toBe("Shared"); // unchanged
    const note = await prisma.activity.findFirst({
      where: { engagementId: eng.id, subject: { contains: "Request NDA" } },
    });
    expect(note).not.toBeNull();
  });
});

d("declineDeal", () => {
  it("sets Declined + Passed, logs activity and a StageChange", async () => {
    const before = await prisma.engagement.findUniqueOrThrow({
      where: { transactionId_investorId: { transactionId: txnId, investorId } },
    });
    await declineDeal(form(txnId));
    const eng = await prisma.engagement.findUniqueOrThrow({ where: { id: before.id } });
    expect(eng.engagementStage).toBe("Declined");
    expect(eng.status).toBe("Passed");
    const change = await prisma.stageChange.findFirst({
      where: { engagementId: eng.id, field: "engagementStage", toValue: "Declined" },
    });
    expect(change?.fromValue).toBe("Shared");
    const note = await prisma.activity.findFirst({
      where: { engagementId: eng.id, subject: { contains: "withdrew" } },
    });
    expect(note).not.toBeNull();
  });

  it("declined deals disappear from actionable set — a repeat decline hits notFound", async () => {
    await expect(declineDeal(form(txnId))).rejects.toThrow("notFound");
  });

  it("never declines an Invested engagement (server-side guard, race-safe updateMany)", async () => {
    // A fresh engagement, forced straight to Invested (as if staff progressed
    // it past decline-ability) — the Declined-only early-return above is
    // bypassed for THIS engagement since it never was Declined.
    const client = await prisma.client.create({ data: { name: `Client2 ${UNIQ}` } });
    const txn2 = await prisma.transaction.create({ data: { name: `Deal2 ${UNIQ}`, clientId: client.id } });
    const engagement = await prisma.engagement.create({
      data: {
        name: `Invested Eng ${UNIQ}`,
        transactionId: txn2.id,
        investorId,
        engagementStage: "Invested",
        status: "Committed",
        createdSource: "API",
      },
    });
    await declineDeal(form(txn2.id));
    const after = await prisma.engagement.findUniqueOrThrow({ where: { id: engagement.id } });
    expect(after.engagementStage).toBe("Invested");
    const change = await prisma.stageChange.findFirst({
      where: { engagementId: engagement.id, field: "engagementStage", toValue: "Declined" },
    });
    expect(change).toBeNull();
    // Cleanup this deal's own rows (outside the shared afterAll fixture set).
    await prisma.engagement.deleteMany({ where: { id: engagement.id } });
    await prisma.transaction.deleteMany({ where: { id: txn2.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
  });
});
