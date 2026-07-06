import { describe, it, expect } from "vitest";
import { visiblePrepMilestones, PREP_MILESTONES } from "@/lib/milestones";

describe("visiblePrepMilestones (spec §6.1)", () => {
  it("hides the Valuation row for Debt deals only", () => {
    expect(visiblePrepMilestones("Debt").map((m) => m.key)).not.toContain("Valuation");
    expect(visiblePrepMilestones("Equity").map((m) => m.key)).toContain("Valuation");
    expect(visiblePrepMilestones("EquityAndDebt").map((m) => m.key)).toContain("Valuation");
    expect(visiblePrepMilestones(null)).toEqual([...PREP_MILESTONES]);
    expect(visiblePrepMilestones(undefined)).toEqual([...PREP_MILESTONES]);
  });
});
