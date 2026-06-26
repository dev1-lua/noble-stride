import { describe, it, expect } from "vitest";
import { amountPending, deriveYearQuarter } from "@/server/domain/disbursement";

describe("disbursement math", () => {
  it("computes pending = total - disbursed", () => {
    expect(amountPending(10, 4)).toBe(6);
  });
  it("returns null pending when total is null", () => {
    expect(amountPending(null, 4)).toBeNull();
  });
  it("treats missing disbursed as zero", () => {
    expect(amountPending(10, null)).toBe(10);
  });
  it("derives year and quarter from a date", () => {
    expect(deriveYearQuarter(new Date("2026-05-15"))).toEqual({ year: 2026, quarter: 2 });
  });
});
