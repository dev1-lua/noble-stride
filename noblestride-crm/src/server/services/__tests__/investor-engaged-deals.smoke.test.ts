// F6b.1 / WS-C `my_deals` (image21: "will the investor agent know which deal I
// am looking at?"). Against the real DB, because the two things worth locking
// down are both about what comes OUT: the deal is named by its codename, and an
// unknown address gets an empty list rather than an error it could read as
// "yes, that person is one of yours".

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const UNIQ = `engaged-${Date.now()}`;
const EMAIL = `zz-engaged-${UNIQ}@zzengaged.test`;
const DEAL_NAME = `zz-Engaged Deal ${UNIQ}`;

let investorId: string;
let clientId: string;
let transactionId: string;
let declinedTransactionId: string;

d("investorEngagedDealsByEmail (DB)", () => {
  beforeAll(async () => {
    const { prisma } = await import("@/lib/db");
    const investor = await prisma.investor.create({
      data: {
        name: `zz-Engaged Fund ${UNIQ}`,
        investorType: "PrivateEquity",
        onboardingStatus: "Approved",
        contacts: {
          create: { firstName: "Eve", lastName: "Engaged", email: EMAIL, isPrimaryContact: true },
        },
      },
      select: { id: true },
    });
    investorId = investor.id;

    const client = await prisma.client.create({
      data: { name: `zz-Engaged Client ${UNIQ}`, sector: ["Technology"], countries: ["EastAfrica"] },
      select: { id: true },
    });
    clientId = client.id;

    const txn = await prisma.transaction.create({
      data: { name: DEAL_NAME, clientId, targetRaise: 4_000_000, currency: "USD", sector: ["Technology"] },
      select: { id: true },
    });
    transactionId = txn.id;
    const declined = await prisma.transaction.create({
      data: { name: `zz-Declined Deal ${UNIQ}`, clientId },
      select: { id: true },
    });
    declinedTransactionId = declined.id;

    await prisma.engagement.create({
      data: {
        name: `zz-Engaged Engagement ${UNIQ}`,
        transactionId,
        investorId,
        engagementStage: "DueDiligence",
        status: "Interested",
        lastContact: new Date("2026-08-20T00:00:00Z"),
      },
    });
    await prisma.engagement.create({
      data: {
        name: `zz-Declined Engagement ${UNIQ}`,
        transactionId: declinedTransactionId,
        investorId,
        engagementStage: "Declined",
        status: "Passed",
      },
    });
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.engagement.deleteMany({ where: { investorId } });
    await prisma.transaction.deleteMany({ where: { clientId } });
    await prisma.person.deleteMany({ where: { investorId } });
    await prisma.investor.delete({ where: { id: investorId } });
    await prisma.client.delete({ where: { id: clientId } });
  });

  it("returns the fund's live engagements, named by codename", async () => {
    const { investorEngagedDealsByEmail } = await import("../investor-agent");
    const { dealCodename } = await import("@/server/visibility/codename");

    const deals = await investorEngagedDealsByEmail(EMAIL);
    expect(deals).toHaveLength(1);
    const deal = deals[0];
    expect(deal.dealId).toBe(transactionId);
    expect(deal.codename).toBe(dealCodename(transactionId));
    // The real deal name must never reach an email-channel agent.
    expect(JSON.stringify(deals)).not.toContain(DEAL_NAME);
    expect(deal.stage).toBe("DueDiligence");
    expect(deal.status).toBe("Interested");
    expect(deal.targetRaise).toBe(4_000_000);
    expect(deal.sector).toContain("Technology");
    expect(deal.countries).toContain("EastAfrica");
    expect(deal.portalUrl).toContain(`/portal/investor/deals/${transactionId}`);
  });

  it("is case- and whitespace-insensitive about the address", async () => {
    const { investorEngagedDealsByEmail } = await import("../investor-agent");
    expect(await investorEngagedDealsByEmail(`  ${EMAIL.toUpperCase()}  `)).toHaveLength(1);
  });

  it("drops a deal the fund withdrew from", async () => {
    const { investorEngagedDealsByEmail } = await import("../investor-agent");
    const ids = (await investorEngagedDealsByEmail(EMAIL)).map((d) => d.dealId);
    expect(ids).not.toContain(declinedTransactionId);
  });

  it("returns an empty list — never an error — for an address we do not know", async () => {
    const { investorEngagedDealsByEmail } = await import("../investor-agent");
    expect(await investorEngagedDealsByEmail("zz-nobody@zzengaged.test")).toEqual([]);
    expect(await investorEngagedDealsByEmail("")).toEqual([]);
  });

  it("returns an empty list for a person with no investor", async () => {
    const { prisma } = await import("@/lib/db");
    const { investorEngagedDealsByEmail } = await import("../investor-agent");
    const orphanEmail = `zz-orphan-${UNIQ}@zzengaged.test`;
    const person = await prisma.person.create({
      data: { firstName: "Orphan", lastName: "Person", email: orphanEmail },
      select: { id: true },
    });
    expect(await investorEngagedDealsByEmail(orphanEmail)).toEqual([]);
    await prisma.person.delete({ where: { id: person.id } });
  });
});
