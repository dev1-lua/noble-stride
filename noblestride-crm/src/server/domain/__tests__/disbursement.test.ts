import { describe, it, expect } from "vitest";
import { amountPending, deriveYearQuarter, groupDisbursementsByPeriod } from "@/server/domain/disbursement";

describe("groupDisbursementsByPeriod", () => {
  it("buckets by stored year/quarter, falling back to dateReceived", () => {
    const rows = [
      { totalAmount: 10, amountDisbursed: 4, amountPending: null, dateReceived: null, year: 2025, quarter: 4 },
      { totalAmount: 5, amountDisbursed: 5, amountPending: 0, dateReceived: new Date(Date.UTC(2026, 0, 10)), year: null, quarter: null },
      { totalAmount: 8, amountDisbursed: 2, amountPending: 6, dateReceived: null, year: 2026, quarter: 1 },
      { totalAmount: null, amountDisbursed: null, amountPending: null, dateReceived: null, year: null, quarter: null }, // dropped
    ];
    expect(groupDisbursementsByPeriod(rows)).toEqual([
      { year: 2025, quarter: 4, disbursed: 4, pending: 6 },
      { year: 2026, quarter: 1, disbursed: 7, pending: 6 },
    ]);
  });

  it("sorts ascending across years and quarters", () => {
    const rows = [
      { totalAmount: 1, amountDisbursed: 1, amountPending: 0, dateReceived: null, year: 2026, quarter: 2 },
      { totalAmount: 1, amountDisbursed: 1, amountPending: 0, dateReceived: null, year: 2024, quarter: 3 },
      { totalAmount: 1, amountDisbursed: 1, amountPending: 0, dateReceived: null, year: 2026, quarter: 1 },
    ];
    expect(groupDisbursementsByPeriod(rows).map((r) => `${r.year}-Q${r.quarter}`)).toEqual([
      "2024-Q3",
      "2026-Q1",
      "2026-Q2",
    ]);
  });

  it("derives pending from total − disbursed when amountPending is missing", () => {
    const rows = [
      { totalAmount: 9, amountDisbursed: 3, amountPending: null, dateReceived: null, year: 2026, quarter: 1 },
    ];
    expect(groupDisbursementsByPeriod(rows)).toEqual([{ year: 2026, quarter: 1, disbursed: 3, pending: 6 }]);
  });
});

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
