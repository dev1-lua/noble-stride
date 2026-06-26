import { describe, it, expect } from "vitest";
import { EngagementStage, InvestorEngagementClassification, Sector, InvestorType } from "@prisma/client";
import { LABELS } from "@/lib/vocab";

describe("new controlled vocabularies", () => {
  it("defines the 12 engagement stages", () => {
    expect(Object.values(EngagementStage)).toEqual([
      "Shared","TeaserSent","NDASigned","IMShared","VDRAccess","Meeting",
      "InfoRequest","DueDiligence","TermSheet","Offer","Invested","Declined",
    ]);
  });
  it("defines the 5 investor engagement classifications", () => {
    expect(Object.values(InvestorEngagementClassification)).toContain("Greylisted");
    expect(Object.values(InvestorEngagementClassification)).toContain("Excluded");
  });
  it("widens Sector and InvestorType per spec", () => {
    expect(Object.values(Sector)).toContain("Aviation");
    expect(Object.values(Sector)).toContain("WaterSanitation");
    expect(Object.values(InvestorType)).toContain("Corporate");
    expect(Object.values(InvestorType)).toContain("Individual");
  });
  it("labels every EngagementStage value", () => {
    for (const v of Object.values(EngagementStage)) {
      expect(LABELS.EngagementStage[v]).toBeTruthy();
    }
  });
});
