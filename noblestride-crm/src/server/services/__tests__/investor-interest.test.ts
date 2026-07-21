import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { expressDealInterestFromAgent } from "@/server/services/investor-agent";

let dbUp = true;
async function checkDb() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbUp = false;
  }
}

let ownerId = "";
let clientId = "";
let txnId = "";
let investorId = ""; // has an active Shared engagement
let investorNoEngId = ""; // no engagement at all
let investorPassedId = ""; // has a Passed engagement (must NOT match)

beforeAll(async () => {
  await checkDb();
  if (!dbUp) return;
  ownerId = (await prisma.user.create({ data: { name: "ZZIntTest Owner", email: "zzint-owner@int.test.local", role: "DealLead" } })).id;
  clientId = (await prisma.client.create({ data: { name: "ZZIntTest Client", sector: ["FinancialServices"], countries: ["EastAfrica"] } })).id;
  txnId = (await prisma.transaction.create({ data: { name: "ZZIntTest Deal", clientId, sector: ["FinancialServices"], instrument: ["Equity"], ownerId } })).id;

  const mkInvestor = (name: string) =>
    prisma.investor.create({ data: { name, investorType: "PrivateEquity", sectorFocus: ["FinancialServices"], geographicFocus: ["EastAfrica"], instruments: ["Equity"], status: "ActivelyDeploying" } });

  investorId = (await mkInvestor("ZZIntTest Fund")).id;
  await prisma.engagement.create({ data: { name: "ZZIntTest Fund x Deal", transactionId: txnId, investorId, engagementStage: "Shared", status: "Contacted", ownerId, createdSource: "AGENT" } });

  investorNoEngId = (await mkInvestor("ZZIntTest NoEng Fund")).id;

  investorPassedId = (await mkInvestor("ZZIntTest Passed Fund")).id;
  await prisma.engagement.create({ data: { name: "ZZIntTest Passed x Deal", transactionId: txnId, investorId: investorPassedId, engagementStage: "Shared", status: "Passed", ownerId, createdSource: "AGENT" } });
});

afterAll(async () => {
  if (!dbUp) return;
  await prisma.notification.deleteMany({ where: { userId: ownerId } });
  await prisma.activity.deleteMany({ where: { transactionId: txnId } });
  await prisma.engagement.deleteMany({ where: { transactionId: txnId } });
  await prisma.transaction.deleteMany({ where: { name: { startsWith: "ZZIntTest" } } });
  await prisma.investor.deleteMany({ where: { name: { startsWith: "ZZIntTest" } } });
  await prisma.client.deleteMany({ where: { name: { startsWith: "ZZIntTest" } } });
  await prisma.user.deleteMany({ where: { email: { contains: "int.test.local" } } });
});

describe("expressDealInterestFromAgent", () => {
  it("matched: bumps status to Interested, logs an activity, notifies the owner, returns a portal deep link", async () => {
    if (!dbUp) return;
    const r = await expressDealInterestFromAgent({ investorId });
    expect(r.matched).toBe(true);
    // Codename, NOT the raw transaction name — the real name must never reach the
    // external email agent (the raw name is only used in the internal notification).
    expect(r.dealName).toMatch(/^Project /);
    expect(r.dealName).not.toBe("ZZIntTest Deal");
    expect(r.portalUrl).toContain("/login?as=investor&next=");
    expect(r.portalUrl).toContain(encodeURIComponent(`/portal/investor/deals/${txnId}`));

    const eng = await prisma.engagement.findFirst({ where: { transactionId: txnId, investorId } });
    expect(eng!.status).toBe("Interested"); // Contacted → Interested

    const notif = await prisma.notification.findFirst({ where: { userId: ownerId, kind: "interest_expressed", href: `/engagement/${eng!.id}` } });
    expect(notif).toBeTruthy();
    expect(notif!.title).toContain("ZZIntTest Deal");

    const act = await prisma.activity.findFirst({ where: { engagementId: eng!.id, subject: { contains: "expressed interest" } } });
    expect(act).toBeTruthy();
  });

  it("no active outreach engagement → matched:false, no portal link", async () => {
    if (!dbUp) return;
    const r = await expressDealInterestFromAgent({ investorId: investorNoEngId });
    expect(r.matched).toBe(false);
    expect(r.portalUrl).toBeUndefined();
  });

  it("a Passed engagement is excluded (never a false match)", async () => {
    if (!dbUp) return;
    const r = await expressDealInterestFromAgent({ investorId: investorPassedId });
    expect(r.matched).toBe(false);
  });

  it("throws for an unknown investor", async () => {
    if (!dbUp) return;
    await expect(expressDealInterestFromAgent({ investorId: "does-not-exist" })).rejects.toThrow(/not found/i);
  });
});
