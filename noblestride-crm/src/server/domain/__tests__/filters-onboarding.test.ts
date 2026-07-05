import { describe, it, expect } from "vitest";
import { buildInvestorWhere } from "@/server/domain/filters";

describe("buildInvestorWhere — onboarding", () => {
  it("filters by onboardingStatus", () => {
    expect(buildInvestorWhere({ onboardingStatus: "PendingReview" })).toMatchObject({
      onboardingStatus: "PendingReview",
    });
  });
});
