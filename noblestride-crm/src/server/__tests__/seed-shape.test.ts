import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";

describe("seed backfill (requires seeded DB)", () => {
  it("has engagements spread across stages with disbursement", async () => {
    const withStage = await prisma.engagement.count({ where: { engagementStage: { not: "Shared" } } });
    expect(withStage).toBeGreaterThan(0);
    const disbursed = await prisma.engagement.count({ where: { amountDisbursed: { not: null } } });
    expect(disbursed).toBeGreaterThan(0);
  });
  it("has at least one excluded/greylisted investor and fee-sharing partner", async () => {
    expect(await prisma.investor.count({ where: { engagementClassification: { in: ["Excluded","Greylisted"] } } })).toBeGreaterThan(0);
    expect(await prisma.partner.count({ where: { feeSharingAgreement: true } })).toBeGreaterThan(0);
  });
  it("has service providers and documents", async () => {
    expect(await prisma.serviceProvider.count()).toBeGreaterThan(0);
    expect(await prisma.document.count()).toBeGreaterThan(0);
  });
});
