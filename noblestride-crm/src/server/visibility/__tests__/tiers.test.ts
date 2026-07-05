import { describe, it, expect } from "vitest";
import type { EngagementStage, InvestorEngagementClassification } from "@prisma/client";
import { investorTier, type Tier } from "@/server/visibility/tiers";

// ─── Exhaustive expectation tables (Record keys force compile-time coverage) ──

/** Expected tier per stage when classification is Active (§5.1 rows 2–5). */
const ACTIVE_STAGE_TIERS: Record<EngagementStage, Tier> = {
  Shared: "PRE_INTEREST",
  TeaserSent: "PRE_INTEREST",
  NDASigned: "AFTER_NDA",
  IMShared: "AFTER_NDA",
  Meeting: "AFTER_NDA",
  InfoRequest: "AFTER_NDA",
  TermSheet: "AFTER_NDA",
  Offer: "AFTER_NDA",
  VDRAccess: "DD",
  DueDiligence: "DD",
  Invested: "DD",
  Declined: "NONE",
};

/** Whether a classification blocks all access (§5.1 row 1). */
const CLASSIFICATION_BLOCKED: Record<InvestorEngagementClassification, boolean> = {
  Active: false,
  Inactive: true,
  OnHold: true,
  Excluded: true,
  Greylisted: true,
};

const CLASSIFICATIONS = Object.keys(CLASSIFICATION_BLOCKED) as InvestorEngagementClassification[];
const STAGES = Object.keys(ACTIVE_STAGE_TIERS) as EngagementStage[];

describe("investorTier — exhaustive classification × stage table (§5.1)", () => {
  for (const classification of CLASSIFICATIONS) {
    const blocked = CLASSIFICATION_BLOCKED[classification];

    for (const stage of STAGES) {
      const expected: Tier = blocked ? "NONE" : ACTIVE_STAGE_TIERS[stage];
      it(`${classification} × ${stage} → ${expected}`, () => {
        expect(
          investorTier(
            { engagementClassification: classification, onboardingStatus: "Approved" },
            { engagementStage: stage },
          ),
        ).toBe(expected);
      });
    }

    const noEngagementExpected: Tier = blocked ? "NONE" : "PRE_INTEREST";
    it(`${classification} × no engagement → ${noEngagementExpected}`, () => {
      expect(
        investorTier({ engagementClassification: classification, onboardingStatus: "Approved" }),
      ).toBe(noEngagementExpected);
      expect(
        investorTier({ engagementClassification: classification, onboardingStatus: "Approved" }, null),
      ).toBe(noEngagementExpected);
    });
  }

  it("classification block wins over a DD-level stage", () => {
    expect(
      investorTier(
        { engagementClassification: "Excluded", onboardingStatus: "Approved" },
        { engagementStage: "Invested" },
      ),
    ).toBe("NONE");
  });

  it("onboarding block wins even over an Active classification at a DD-level stage", () => {
    expect(
      investorTier(
        { engagementClassification: "Active", onboardingStatus: "PendingReview" },
        { engagementStage: "Invested" },
      ),
    ).toBe("NONE");
  });
});
