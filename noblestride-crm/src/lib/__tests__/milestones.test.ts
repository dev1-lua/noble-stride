import { describe, it, expect } from "vitest";
import {
  visiblePrepMilestones,
  PREP_MILESTONES,
  MILESTONE_ORDER,
  INVESTOR_VISIBLE_MILESTONES,
} from "@/lib/milestones";

describe("visiblePrepMilestones (spec §6.1)", () => {
  it("hides the Valuation row for Debt deals only", () => {
    expect(visiblePrepMilestones("Debt").map((m) => m.key)).not.toContain("Valuation");
    expect(visiblePrepMilestones("Equity").map((m) => m.key)).toContain("Valuation");
    expect(visiblePrepMilestones("EquityAndDebt").map((m) => m.key)).toContain("Valuation");
    expect(visiblePrepMilestones(null)).toEqual([...PREP_MILESTONES]);
    expect(visiblePrepMilestones(undefined)).toEqual([...PREP_MILESTONES]);
  });
});

// F6b.3 / image29: the success fee is between Noblestride and its client.
describe("INVESTOR_VISIBLE_MILESTONES", () => {
  it("is the 14 pre-fee milestones, in order", () => {
    expect(INVESTOR_VISIBLE_MILESTONES).toHaveLength(14);
    expect(INVESTOR_VISIBLE_MILESTONES).not.toContain("SuccessFeePaid");
    expect(INVESTOR_VISIBLE_MILESTONES).toEqual(MILESTONE_ORDER.filter((k) => k !== "SuccessFeePaid"));
  });

  it("is derived, so it stays one shorter than the internal list", () => {
    expect(INVESTOR_VISIBLE_MILESTONES.length).toBe(MILESTONE_ORDER.length - 1);
  });
});
