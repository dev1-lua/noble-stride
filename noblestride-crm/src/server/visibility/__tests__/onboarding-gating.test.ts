import { describe, it, expect } from "vitest";
import { investorTier, isOnboardingBlocked } from "@/server/visibility/tiers";
import { projectDealForInvestor, discoverableDealsForInvestor, type DealInput } from "@/server/visibility/project";
import { dealCodename } from "@/server/visibility/codename";

const deal: DealInput = {
  id: "deal-1",
  name: "Acme Foods – Series B",
  stage: "InvestorOutreach",
  sector: ["Agribusiness"],
  targetRaise: 3_000_000,
  client: {
    name: "Acme Foods Ltd",
    sector: ["Agribusiness"],
    countries: ["EastAfrica"],
    revenueLastYear: 2_000_000,
  },
  documents: [
    { id: "d1", name: "Teaser", type: "Teaser", accessLevel: "InvestorShared" },
    { id: "d2", name: "Data room pack", type: "AuditedAccounts", accessLevel: "VDR" },
  ],
};

describe("onboarding gate", () => {
  it("PendingReview and Rejected are blocked", () => {
    expect(isOnboardingBlocked("PendingReview")).toBe(true);
    expect(isOnboardingBlocked("Rejected")).toBe(true);
    expect(isOnboardingBlocked("Approved")).toBe(false);
  });
  it("pending investor resolves to tier NONE even when Active", () => {
    expect(investorTier({ engagementClassification: "Active", onboardingStatus: "PendingReview" }, null)).toBe("NONE");
  });
  it("pending investor discovers nothing", () => {
    const pending = { engagementClassification: "Active", onboardingStatus: "PendingReview" } as const;
    expect(discoverableDealsForInvestor({ ...pending }, [deal])).toEqual([]);
  });
});

describe("teaser masking (PRE_INTEREST)", () => {
  const projected = projectDealForInvestor(deal, "PRE_INTEREST")!;
  it("masks the deal and client names with a deterministic codename", () => {
    const code = dealCodename("deal-1");
    expect(projected.name).toBe(code);
    expect(projected.companyProfile.clientName).toBe(code);
    expect(code).toMatch(/^Project /);
    expect(dealCodename("deal-1")).toBe(code); // deterministic
  });
  it("unmasks after NDA", () => {
    const after = projectDealForInvestor(deal, "AFTER_NDA")!;
    expect(after.name).toBe("Acme Foods – Series B");
    expect(after.companyProfile.clientName).toBe("Acme Foods Ltd");
  });
});

describe("NDA-aware VDR docs", () => {
  it("hides VDR docs at DD without a satisfied NDA", () => {
    const withoutNda = projectDealForInvestor(deal, "DD")!;
    expect(withoutNda.documents.some((d) => d.id === "d2")).toBe(false);
  });
  it("shows VDR docs at DD with a satisfied NDA", () => {
    const withNda = projectDealForInvestor(deal, "DD", { ndaSatisfied: true })!;
    expect(withNda.documents.some((d) => d.id === "d2")).toBe(true);
  });
});
