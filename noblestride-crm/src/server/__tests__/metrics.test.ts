import { describe, it, expect } from "vitest";
import {
  quarterRange, daysInStage, avgTimeToCloseMonths,
  isActiveInvestorThisQuarter, partnerReferralRollup,
} from "@/server/domain/metrics";

const NOW = new Date("2026-06-19T12:00:00Z");

describe("metrics", () => {
  it("daysInStage counts whole days", () => {
    expect(daysInStage(new Date("2026-06-11T12:00:00Z"), NOW)).toBe(8);
  });
  it("avgTimeToCloseMonths averages closed deals", () => {
    const r = avgTimeToCloseMonths([
      { dateOpened: new Date("2026-01-01"), closedAt: new Date("2026-04-01") }, // ~3mo
      { dateOpened: new Date("2026-01-01"), closedAt: new Date("2026-06-01") }, // ~5mo
    ]);
    expect(r).toBeCloseTo(4, 0);
  });
  it("avgTimeToCloseMonths -> null when none closed", () => {
    expect(avgTimeToCloseMonths([{ dateOpened: new Date(), closedAt: null }])).toBeNull();
  });
  it("active investor by status", () => {
    expect(isActiveInvestorThisQuarter({ status: "ActivelyDeploying", activityDates: [] }, NOW)).toBe(true);
  });
  it("active investor by recent activity", () => {
    const q = quarterRange(NOW);
    expect(isActiveInvestorThisQuarter({ status: null, activityDates: [q.start] }, NOW)).toBe(true);
  });
  it("inactive investor", () => {
    expect(isActiveInvestorThisQuarter({ status: "Dormant", activityDates: [new Date("2025-01-01")] }, NOW)).toBe(false);
  });
  it("partner rollup", () => {
    expect(partnerReferralRollup({
      mandates: [
        { transactions: [{ stage: "ClosedWon", targetRaise: 5_000_000 }] },
        { transactions: [{ stage: "DueDiligence", targetRaise: 2_000_000 }] },
        { transactions: [] },
      ],
    })).toEqual({ referred: 3, active: 1, closed: 1, revenue: 5_000_000 });
  });
  it("partner rollup counts direct transaction referrals", () => {
    expect(partnerReferralRollup({
      mandates: [
        { transactions: [{ stage: "ClosedWon", targetRaise: 5_000_000 }] },
      ],
      directTransactions: [
        { stage: "ClosedWon", targetRaise: 3_000_000 },
        { stage: "DueDiligence", targetRaise: 1_000_000 },
        { stage: "ClosedLost", targetRaise: 9_000_000 },
      ],
    })).toEqual({ referred: 4, active: 1, closed: 2, revenue: 8_000_000 });
  });
});
