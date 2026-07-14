import { describe, it, expect } from "vitest";
import { checkExcludedGuard } from "../guards";

const investor = (classification: string | null) => ({ name: "Shadow Fund", engagementClassification: classification });

describe("checkExcludedGuard", () => {
  it.each(["Active", "Inactive", "OnHold", null])("allows any change for classification %s", (c) => {
    expect(checkExcludedGuard(investor(c), { engagementStage: "Offer" }).allowed).toBe(true);
    expect(checkExcludedGuard(investor(c)).allowed).toBe(true);
  });

  it.each(["Excluded", "Greylisted"])("blocks advancing a %s investor", (c) => {
    const verdict = checkExcludedGuard(investor(c), { engagementStage: "Offer" });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.message).toContain(c);
  });

  it.each(["Excluded", "Greylisted"])("blocks a %s investor when no change is supplied (advance-only contexts)", (c) => {
    expect(checkExcludedGuard(investor(c)).allowed).toBe(false);
  });

  it("allows pure wind-down changes for excluded investors", () => {
    expect(checkExcludedGuard(investor("Excluded"), { engagementStage: "Declined" }).allowed).toBe(true);
    expect(checkExcludedGuard(investor("Greylisted"), { disbursementStatus: "FellOff" }).allowed).toBe(true);
    expect(
      checkExcludedGuard(investor("Excluded"), { engagementStage: "Declined", disbursementStatus: "Dropped" }).allowed,
    ).toBe(true);
  });

  it("blocks a wind-down mixed with any other field", () => {
    expect(checkExcludedGuard(investor("Excluded"), { engagementStage: "Declined", probability: 10 }).allowed).toBe(false);
    expect(checkExcludedGuard(investor("Excluded"), { engagementStage: "Invested" }).allowed).toBe(false);
    expect(checkExcludedGuard(investor("Excluded"), { disbursementStatus: "Ongoing" }).allowed).toBe(false);
  });

  it("ignores undefined-valued keys when judging wind-down purity", () => {
    expect(
      checkExcludedGuard(investor("Excluded"), { engagementStage: "Declined", probability: undefined }).allowed,
    ).toBe(true);
  });
});
