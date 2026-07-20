import { describe, expect, it } from "vitest";
import { stepFromHistoryState, withWizardStep } from "../wizard-history";

describe("wizard-history", () => {
  it("reads a valid step", () => {
    expect(stepFromHistoryState({ wizardStep: 3 })).toBe(3);
  });
  it("returns null for missing/invalid state", () => {
    expect(stepFromHistoryState(null)).toBeNull();
    expect(stepFromHistoryState({})).toBeNull();
    expect(stepFromHistoryState({ wizardStep: "2" })).toBeNull();
    expect(stepFromHistoryState({ wizardStep: -1 })).toBeNull();
    expect(stepFromHistoryState({ wizardStep: 1.5 })).toBeNull();
  });
  it("preserves existing history state keys (Next router state must survive)", () => {
    expect(withWizardStep({ __NA: true, k: 1 }, 2)).toEqual({ __NA: true, k: 1, wizardStep: 2 });
  });
  it("tolerates non-object existing state", () => {
    expect(withWizardStep(null, 0)).toEqual({ wizardStep: 0 });
  });
});
