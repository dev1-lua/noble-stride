import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { recordOpenNda, recordClosedNda } from "@/server/services/nda";
import { setOnboardingStatus } from "@/server/services/investors";
import { updateEngagement } from "@/server/services/engagements-crud";
import { NdaGuardError } from "@/server/domain/nda-guard";

const ACTOR = { type: "HUMAN", label: "test" } as const;
const UNIQ = `nda-smoke-${Date.now()}`;
let investorId: string, engagementId: string, txnId: string;

beforeAll(async () => {
  const investor = await prisma.investor.create({
    data: { name: `Fund ${UNIQ}`, investorType: "PrivateEquity", onboardingStatus: "PendingReview" },
  });
  const client = await prisma.client.create({ data: { name: `Client ${UNIQ}` } });
  const txn = await prisma.transaction.create({ data: { name: `Deal ${UNIQ}`, clientId: client.id } });
  const engagement = await prisma.engagement.create({
    data: { name: `Eng ${UNIQ}`, transactionId: txn.id, investorId: investor.id },
  });
  investorId = investor.id; engagementId = engagement.id; txnId = txn.id;
});

afterAll(async () => {
  await prisma.activity.deleteMany({ where: { investorId } });
  await prisma.engagement.deleteMany({ where: { investorId } });
  await prisma.transaction.deleteMany({ where: { name: { contains: UNIQ } } });
  await prisma.client.deleteMany({ where: { name: { contains: UNIQ } } });
  await prisma.investor.deleteMany({ where: { id: investorId } });
});

describe("onboarding + NDA services", () => {
  it("setOnboardingStatus approves and logs an activity", async () => {
    const inv = await setOnboardingStatus(investorId, "Approved", ACTOR);
    expect(inv.onboardingStatus).toBe("Approved");
    const act = await prisma.activity.findFirst({ where: { investorId, subject: { contains: "approved" } } });
    expect(act).not.toBeNull();
  });

  it("blocks restage to NDASigned without any NDA", async () => {
    await expect(updateEngagement(engagementId, { engagementStage: "NDASigned" })).rejects.toThrow(NdaGuardError);
  });

  it("recordClosedNda unlocks that engagement only", async () => {
    await recordClosedNda(engagementId, ACTOR);
    const eng = await prisma.engagement.findUniqueOrThrow({ where: { id: engagementId } });
    expect(eng.ndaType).toBe("Closed");
    expect(eng.ndaSignedAt).toBeInstanceOf(Date);
    const inv = await prisma.investor.findUniqueOrThrow({ where: { id: investorId } });
    expect(inv.ndaStatus).toBe("ClosedNDA");
    await expect(updateEngagement(engagementId, { engagementStage: "NDASigned" })).resolves.toBeTruthy();
  });

  it("recordOpenNda stamps the investor", async () => {
    const inv = await recordOpenNda(investorId, ACTOR);
    expect(inv.ndaStatus).toBe("OpenNDA");
    expect(inv.openNdaSignedAt).toBeInstanceOf(Date);
  });
});
