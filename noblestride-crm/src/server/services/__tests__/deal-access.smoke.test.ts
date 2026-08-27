// F6b.2 (image28) — "Grant deal access", against the real DB.
//
// The refusal is the test that matters. Decision D2: the client's feedback
// implies detail should unmask on interest, SOW §06 says no confidential
// information without an NDA, and the resolution is that grantDealAccess rides
// updateEngagement so assertStageAllowed still runs. If this file ever passes
// with an unsigned NDA, the guard has been bypassed.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/graphql/context";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const UNIQ = `access-${Date.now()}`;
const ACTOR: Actor = { type: "HUMAN" } as Actor;

let investorId: string;
let clientId: string;
let transactionId: string;
let engagementId: string;

d("grantDealAccess (DB)", () => {
  beforeAll(async () => {
    const { prisma } = await import("@/lib/db");
    const investor = await prisma.investor.create({
      data: { name: `zz-Access Fund ${UNIQ}`, investorType: "PrivateEquity", onboardingStatus: "Approved", ndaStatus: "None" },
      select: { id: true },
    });
    investorId = investor.id;
    const client = await prisma.client.create({ data: { name: `zz-Access Client ${UNIQ}` }, select: { id: true } });
    clientId = client.id;
    const txn = await prisma.transaction.create({
      data: { name: `zz-Access Deal ${UNIQ}`, clientId },
      select: { id: true },
    });
    transactionId = txn.id;
  });

  beforeEach(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.stageChange.deleteMany({ where: { investorId } });
    await prisma.activity.deleteMany({ where: { investorId } });
    await prisma.engagement.deleteMany({ where: { investorId } });
    await prisma.investor.update({ where: { id: investorId }, data: { ndaStatus: "None", openNdaSignedAt: null } });
    const engagement = await prisma.engagement.create({
      data: {
        name: `zz-Access Engagement ${UNIQ}`,
        transactionId,
        investorId,
        engagementStage: "Shared",
        status: "Interested",
      },
      select: { id: true },
    });
    engagementId = engagement.id;
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.stageChange.deleteMany({ where: { investorId } });
    await prisma.activity.deleteMany({ where: { investorId } });
    await prisma.notification.deleteMany({ where: { investorId } });
    await prisma.engagement.deleteMany({ where: { investorId } });
    await prisma.transaction.deleteMany({ where: { clientId } });
    await prisma.investor.delete({ where: { id: investorId } });
    await prisma.client.delete({ where: { id: clientId } });
  });

  it("refuses without an NDA and leaves the stage untouched", async () => {
    const { prisma } = await import("@/lib/db");
    const { grantDealAccess } = await import("../deal-access");
    const { NdaGuardError } = await import("@/server/domain/nda-guard");

    await expect(grantDealAccess(engagementId, ACTOR)).rejects.toBeInstanceOf(NdaGuardError);

    const engagement = await prisma.engagement.findUniqueOrThrow({ where: { id: engagementId } });
    expect(engagement.engagementStage).toBe("Shared");
    expect(engagement.accessGrantedAt).toBeNull();
    expect(engagement.accessGrantedById).toBeNull();
    expect(await prisma.stageChange.count({ where: { engagementId } })).toBe(0);
  });

  it("names the portal NDA flow in the refusal, so staff know what to do next", async () => {
    const { grantDealAccess } = await import("../deal-access");
    await expect(grantDealAccess(engagementId, ACTOR)).rejects.toThrow(/Portal → NDA/);
  });

  it("unlocks the deal once the investor has an Open NDA", async () => {
    const { prisma } = await import("@/lib/db");
    const { grantDealAccess } = await import("../deal-access");
    const { recordOpenNda } = await import("../nda");

    await recordOpenNda(investorId, ACTOR);
    const out = await grantDealAccess(engagementId, ACTOR);
    expect(out).toEqual({ engagementId, investorId, dealId: transactionId });

    const engagement = await prisma.engagement.findUniqueOrThrow({ where: { id: engagementId } });
    expect(engagement.engagementStage).toBe("NDASigned");
    expect(engagement.accessGrantedAt).not.toBeNull();

    const stageChanges = await prisma.stageChange.findMany({
      where: { engagementId, field: "engagementStage" },
    });
    expect(stageChanges).toHaveLength(1);
    expect(stageChanges[0].fromValue).toBe("Shared");
    expect(stageChanges[0].toValue).toBe("NDASigned");

    const activity = await prisma.activity.findFirst({
      where: { engagementId, subject: { startsWith: "Deal access granted" } },
    });
    expect(activity).not.toBeNull();
  });

  it("notifies the investor using the codename, never the real deal name", async () => {
    const { prisma } = await import("@/lib/db");
    const { grantDealAccess } = await import("../deal-access");
    const { recordOpenNda } = await import("../nda");
    const { dealCodename } = await import("@/server/visibility/codename");

    await recordOpenNda(investorId, ACTOR);
    await grantDealAccess(engagementId, ACTOR);

    const notification = await prisma.notification.findFirst({
      where: { investorId, kind: "deal_access_granted" },
      orderBy: { createdAt: "desc" },
    });
    expect(notification?.title).toContain(dealCodename(transactionId));
    expect(notification?.title).not.toContain(`zz-Access Deal ${UNIQ}`);
    expect(notification?.href).toBe(`/portal/investor/deals/${transactionId}`);
    await prisma.notification.deleteMany({ where: { investorId } });
  });

  it("a second grant is a no-op — no extra stage change, no second stamp", async () => {
    const { prisma } = await import("@/lib/db");
    const { grantDealAccess } = await import("../deal-access");
    const { recordOpenNda } = await import("../nda");

    await recordOpenNda(investorId, ACTOR);
    await grantDealAccess(engagementId, ACTOR);
    const first = await prisma.engagement.findUniqueOrThrow({ where: { id: engagementId } });

    await grantDealAccess(engagementId, ACTOR);
    const second = await prisma.engagement.findUniqueOrThrow({ where: { id: engagementId } });

    expect(second.accessGrantedAt).toEqual(first.accessGrantedAt);
    expect(await prisma.stageChange.count({ where: { engagementId, field: "engagementStage" } })).toBe(1);
    expect(
      await prisma.activity.count({ where: { engagementId, subject: { startsWith: "Deal access granted" } } }),
    ).toBe(1);
    await prisma.notification.deleteMany({ where: { investorId } });
  });

  it("a Closed NDA on this engagement is enough on its own", async () => {
    const { prisma } = await import("@/lib/db");
    const { grantDealAccess } = await import("../deal-access");

    // Investor still has ndaStatus None; the NDA lives on the engagement.
    await prisma.engagement.update({
      where: { id: engagementId },
      data: { ndaType: "Closed", ndaSignedAt: new Date() },
    });
    await grantDealAccess(engagementId, ACTOR);
    expect(
      (await prisma.engagement.findUniqueOrThrow({ where: { id: engagementId } })).engagementStage,
    ).toBe("NDASigned");
    await prisma.notification.deleteMany({ where: { investorId } });
  });
});
