import { describe, it, expect } from "vitest";
import { stageRequiresNda, ndaSatisfied, assertStageAllowed, NdaGuardError } from "@/server/domain/nda-guard";

describe("stageRequiresNda", () => {
  it.each(["Shared", "TeaserSent", "Declined"] as const)("%s does not require an NDA", (s) => {
    expect(stageRequiresNda(s)).toBe(false);
  });
  it.each(["NDASigned", "IMShared", "Meeting", "InfoRequest", "TermSheet", "Offer", "VDRAccess", "DueDiligence", "Invested"] as const)(
    "%s requires an NDA",
    (s) => expect(stageRequiresNda(s)).toBe(true),
  );
});

describe("ndaSatisfied", () => {
  it("open NDA satisfies every deal", () => {
    expect(ndaSatisfied({ ndaStatus: "OpenNDA" }, null)).toBe(true);
    expect(ndaSatisfied({ ndaStatus: "OpenNDA" }, { ndaType: null })).toBe(true);
  });
  it("closed NDA satisfies only the engagement that has it", () => {
    expect(ndaSatisfied({ ndaStatus: "ClosedNDA" }, { ndaType: "Closed" })).toBe(true);
    expect(ndaSatisfied({ ndaStatus: "ClosedNDA" }, { ndaType: null })).toBe(false);
    expect(ndaSatisfied({ ndaStatus: "ClosedNDA" }, null)).toBe(false);
  });
  it("no NDA satisfies nothing", () => {
    expect(ndaSatisfied({ ndaStatus: "None" }, { ndaType: null })).toBe(false);
  });
});

describe("assertStageAllowed", () => {
  it("blocks VDRAccess without an NDA", () => {
    expect(() => assertStageAllowed("VDRAccess", { ndaStatus: "None" }, { ndaType: null })).toThrow(NdaGuardError);
  });
  it("allows VDRAccess with an open NDA", () => {
    expect(() => assertStageAllowed("VDRAccess", { ndaStatus: "OpenNDA" }, { ndaType: null })).not.toThrow();
  });
  it("allows TeaserSent without an NDA", () => {
    expect(() => assertStageAllowed("TeaserSent", { ndaStatus: "None" }, null)).not.toThrow();
  });
});
