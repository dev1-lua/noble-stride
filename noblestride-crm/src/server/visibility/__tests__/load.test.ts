import { describe, it, expect } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { loadInvestorPortalData, loadPartnerPortalData } from "@/server/visibility/load";
import { FORBIDDEN_STRINGS, makeDealFixture, OWN_INVESTOR_ID } from "./fixtures";

// Pure stub — the loaders only call these three delegates.
function stubPrisma(overrides: {
  investor?: unknown;
  transactions?: unknown[];
  partner?: unknown;
}): PrismaClient {
  return {
    investor: { findUniqueOrThrow: async () => overrides.investor },
    transaction: { findMany: async () => overrides.transactions ?? [] },
    partner: { findUniqueOrThrow: async () => overrides.partner },
  } as unknown as PrismaClient;
}

// Engaged deal (NDASigned for OWN_INVESTOR_ID) deliberately OUTSIDE the
// investor's sector focus — engaged deals must surface even when discovery
// filters would not match them.
const engagedDeal = makeDealFixture();

const discoveryDeal = {
  ...makeDealFixture(),
  id: "txn-2",
  name: "Project Cedar",
  sector: ["Technology" as const],
  client: { ...makeDealFixture().client!, sector: ["Technology" as const] },
  engagements: [],
};

// F6b.1: live, on no engagement, and deliberately OUTSIDE the investor's
// sector focus — the case the old candidate filter dropped entirely.
const offMandateDeal = {
  ...makeDealFixture(),
  id: "txn-3",
  name: "Project Tamarind",
  sector: ["Manufacturing" as const],
  client: { ...makeDealFixture().client!, sector: ["Manufacturing" as const] },
  engagements: [],
};

const investorFixture = {
  id: OWN_INVESTOR_ID,
  name: "Own Fund LP",
  engagementClassification: "Active",
  onboardingStatus: "Approved",
  sectorFocus: ["Technology"],
  geographicFocus: [],
  ticketMin: null,
  ticketMax: null,
  engagements: [{ id: "eng-own", transactionId: "txn-1", investorId: OWN_INVESTOR_ID, engagementStage: "NDASigned" }],
};

describe("loadInvestorPortalData", () => {
  it("returns engaged deals at their tier plus discovery matches at PRE_INTEREST", async () => {
    const prisma = stubPrisma({ investor: investorFixture, transactions: [engagedDeal, discoveryDeal] });
    const portal = await loadInvestorPortalData(prisma, OWN_INVESTOR_ID);

    expect(portal.investor).toEqual({
      id: OWN_INVESTOR_ID,
      name: "Own Fund LP",
      classification: "Active",
    });
    expect(portal.deals).toHaveLength(2);

    const byId = new Map(portal.deals.map((d) => [d.id, d]));
    expect(byId.get("txn-1")?.tier).toBe("AFTER_NDA"); // engaged, off-focus — still visible
    expect(byId.get("txn-2")?.tier).toBe("PRE_INTEREST"); // discovery match, no engagement
  });

  it("returns already-projected data with no forbidden fields", async () => {
    const prisma = stubPrisma({ investor: investorFixture, transactions: [engagedDeal, discoveryDeal] });
    const json = JSON.stringify(await loadInvestorPortalData(prisma, OWN_INVESTOR_ID));
    for (const forbidden of FORBIDDEN_STRINGS) expect(json).not.toContain(forbidden);
  });

  it("blocked classification yields an empty portal even with engagements", async () => {
    const prisma = stubPrisma({
      investor: { ...investorFixture, engagementClassification: "Excluded" },
      transactions: [engagedDeal, discoveryDeal],
    });
    const portal = await loadInvestorPortalData(prisma, OWN_INVESTOR_ID);
    expect(portal.deals).toEqual([]);
  });

  it("pending onboarding yields an empty portal even with engagements", async () => {
    const prisma = stubPrisma({
      investor: { ...investorFixture, onboardingStatus: "PendingReview" },
      transactions: [engagedDeal, discoveryDeal],
    });
    const portal = await loadInvestorPortalData(prisma, OWN_INVESTOR_ID);
    expect(portal.deals).toEqual([]);
  });

  it("wires NDA status through to VDR-doc visibility at DD tier", async () => {
    const ddEngagement = {
      id: "eng-own",
      transactionId: "txn-1",
      investorId: OWN_INVESTOR_ID,
      engagementStage: "DueDiligence" as const,
      ndaType: null,
    };

    const noNda = stubPrisma({
      investor: { ...investorFixture, ndaStatus: "None", engagements: [ddEngagement] },
      transactions: [engagedDeal, discoveryDeal],
    });
    const withoutNda = await loadInvestorPortalData(noNda, OWN_INVESTOR_ID);
    expect(withoutNda.deals.find((d) => d.id === "txn-1")?.documents.some((d) => d.id === "doc-vdr")).toBe(false);

    const openNda = stubPrisma({
      investor: { ...investorFixture, ndaStatus: "OpenNDA", engagements: [ddEngagement] },
      transactions: [engagedDeal, discoveryDeal],
    });
    const withNda = await loadInvestorPortalData(openNda, OWN_INVESTOR_ID);
    expect(withNda.deals.find((d) => d.id === "txn-1")?.documents.some((d) => d.id === "doc-vdr")).toBe(true);
  });

  // ── F6b.1 (image27): "the investor should see all the deals" ──────────────

  it("includes live deals outside the investor's discovery match, flagged matchesMandate:false", async () => {
    const prisma = stubPrisma({ investor: investorFixture, transactions: [engagedDeal, discoveryDeal, offMandateDeal] });
    const { deals } = await loadInvestorPortalData(prisma, OWN_INVESTOR_ID);
    expect(deals).toHaveLength(3);
    const byId = new Map(deals.map((d) => [d.id, d]));
    expect(byId.get("txn-3")?.tier).toBe("PRE_INTEREST");
    expect(byId.get("txn-3")?.matchesMandate).toBe(false);
    expect(byId.get("txn-1")?.matchesMandate).toBe(false); // engaged but off-focus
  });

  it("marks discovery hits matchesMandate:true", async () => {
    const prisma = stubPrisma({ investor: investorFixture, transactions: [discoveryDeal, offMandateDeal] });
    const { deals } = await loadInvestorPortalData(prisma, OWN_INVESTOR_ID);
    expect(new Map(deals.map((d) => [d.id, d])).get("txn-2")?.matchesMandate).toBe(true);
  });

  it("still shows nothing for a blocked classification or an unapproved investor", async () => {
    for (const patch of [{ engagementClassification: "Excluded" }, { onboardingStatus: "PendingReview" }]) {
      const prisma = stubPrisma({
        investor: { ...investorFixture, ...patch },
        transactions: [engagedDeal, discoveryDeal, offMandateDeal],
      });
      expect((await loadInvestorPortalData(prisma, OWN_INVESTOR_ID)).deals).toEqual([]);
    }
  });

  it("match:true narrows to mandate matches only", async () => {
    const prisma = stubPrisma({ investor: investorFixture, transactions: [discoveryDeal, offMandateDeal] });
    const { deals } = await loadInvestorPortalData(prisma, OWN_INVESTOR_ID, { match: true });
    expect(deals.map((d) => d.id)).toEqual(["txn-2"]);
  });

  it("still keeps forbidden internal fields out of the widened set", async () => {
    const prisma = stubPrisma({ investor: investorFixture, transactions: [engagedDeal, discoveryDeal, offMandateDeal] });
    const json = JSON.stringify(await loadInvestorPortalData(prisma, OWN_INVESTOR_ID));
    for (const forbidden of FORBIDDEN_STRINGS) expect(json).not.toContain(forbidden);
  });

  // Declining is the one stage the portal sets itself, and it is
  // access-reducing: the declined deal disappears from the browse list. After
  // F6b.1 the OTHER live deals stay browsable (that is the point of the
  // change), so this asserts the declined deal specifically.
  it("declined engagement drops that deal but not the rest of the market", async () => {
    const prisma = stubPrisma({
      investor: {
        ...investorFixture,
        sectorFocus: ["Healthcare"], // discovery matches neither deal
        engagements: [{ ...investorFixture.engagements[0], engagementStage: "Declined" }],
      },
      transactions: [engagedDeal, discoveryDeal],
    });
    const portal = await loadInvestorPortalData(prisma, OWN_INVESTOR_ID);
    expect(portal.deals.map((d) => d.id)).toEqual(["txn-2"]);
    expect(portal.deals[0]?.tier).toBe("PRE_INTEREST");
    expect(portal.deals[0]?.matchesMandate).toBe(false);
  });
});

describe("loadPartnerPortalData", () => {
  it("returns the projected partner view", async () => {
    const prisma = stubPrisma({
      partner: {
        id: "pt-1",
        name: "Savannah Deal Advisors",
        advisorType: "TransactionAdvisor",
        organization: null,
        feeSharingAgreement: false,
        feeSharingTerms: null,
        partnerAgreementStatus: "None",
        referredMandates: [
          { id: "m-1", name: "Mandate Alpha", stage: "Signed", dealSize: 6_000_000, currency: "USD", client: { name: "Acme Agri Ltd" } },
        ],
      },
    });
    const view = await loadPartnerPortalData(prisma, "pt-1");
    expect(view.profile.name).toBe("Savannah Deal Advisors");
    expect(view.referredDeals).toHaveLength(1);
    expect(view.referredDeals[0]?.converted).toBe(true);
  });
});
