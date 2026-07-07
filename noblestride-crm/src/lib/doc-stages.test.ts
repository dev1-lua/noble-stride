import { describe, it, expect } from "vitest";
import { stageForDocType, docTypesForStage, WORKFLOW_STAGE_ORDER } from "./doc-stages";

describe("doc-stages", () => {
  it("maps NDA and Engagement + Fee-Share to Onboarding", () => {
    expect(stageForDocType("NDA")).toBe("Onboarding");
    expect(stageForDocType("EngagementContract")).toBe("Onboarding");
    expect(stageForDocType("FeeShareAgreement")).toBe("Onboarding");
  });
  it("maps prep documents to DealPreparation", () => {
    for (const t of ["Teaser", "IM", "FinancialModel", "Valuation", "BusinessPlan", "PitchDeck"])
      expect(stageForDocType(t)).toBe("DealPreparation");
  });
  it("maps closing documents to Closing", () => {
    for (const t of ["LoanAgreement", "SPA", "SHA"]) expect(stageForDocType(t)).toBe("Closing");
  });
  it("maps TermSheet and DD docs correctly", () => {
    expect(stageForDocType("TermSheet")).toBe("TermSheet");
    expect(stageForDocType("AuditedAccounts")).toBe("DueDiligence");
    expect(stageForDocType("CR12")).toBe("DueDiligence");
  });
  it("returns null for unmapped / Other", () => {
    expect(stageForDocType("Other")).toBeNull();
    expect(stageForDocType("Nonsense")).toBeNull();
  });
  it("docTypesForStage is the inverse and covers every ordered stage", () => {
    for (const s of WORKFLOW_STAGE_ORDER) {
      const types = docTypesForStage(s);
      for (const t of types) expect(stageForDocType(t)).toBe(s);
    }
    expect(docTypesForStage("Onboarding")).toContain("FeeShareAgreement");
  });
});
