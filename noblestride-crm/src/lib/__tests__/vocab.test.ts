import { describe, it, expect } from "vitest";
import {
  EngagementStage, InvestorEngagementClassification, Sector, InvestorType,
  WorkflowPhase, DealKind, AdvisoryClassification, Source, DocumentType,
} from "@prisma/client";
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
  it("labels every WorkflowPhase, DealKind and AdvisoryClassification value (Aug-2026)", () => {
    for (const v of Object.values(WorkflowPhase)) expect(LABELS.WorkflowPhase[v]).toBeTruthy();
    for (const v of Object.values(DealKind)) expect(LABELS.DealKind[v]).toBeTruthy();
    for (const v of Object.values(AdvisoryClassification)) expect(LABELS.AdvisoryClassification[v]).toBeTruthy();
    expect(LABELS.AdvisoryClassification.BusinessPlanPitchDeck).toBe("Business Plan / Pitch Deck");
    expect(LABELS.AdvisoryClassification.DueDiligence).toBe("Due Diligence");
  });
  it("labels every Source and DocumentType value", () => {
    for (const v of Object.values(Source)) expect(LABELS.Source[v]).toBeTruthy();
    for (const v of Object.values(DocumentType)) expect(LABELS.DocumentType[v]).toBeTruthy();
  });
  it("adds the diagram step-1 sources (G4)", () => {
    expect(Object.values(Source)).toContain("DeskResearch");
    expect(Object.values(Source)).toContain("ExistingNetwork");
    expect(LABELS.Source.DeskResearch).toBe("Desk research");
    expect(LABELS.Source.ExistingNetwork).toBe("Existing network");
  });
});
