import { describe, it, expect } from "vitest";
import { formatMoney, balanceDue } from "@/lib/money";

describe("formatMoney", () => {
  it("formats millions", () => expect(formatMoney(18_400_000)).toBe("$18.4M"));
  it("formats thousands", () => expect(formatMoney(680_000)).toBe("$680K"));
  it("formats small", () => expect(formatMoney(500)).toBe("$500"));
  it("handles null", () => expect(formatMoney(null)).toBe(""));
  it("respects currency", () => expect(formatMoney(5_000_000, "USD")).toBe("$5.0M"));
});

describe("balanceDue", () => {
  it("is the unpaid remainder", () => {
    expect(balanceDue(50_000, 20_000)).toBe(30_000);
    expect(balanceDue(10_000, 2_500)).toBe(7_500);
  });
  it("treats no payment as nothing paid", () => {
    expect(balanceDue(50_000, null)).toBe(50_000);
    expect(balanceDue(50_000, undefined)).toBe(50_000);
  });
  it("is zero once fully paid, and never negative on an overpayment", () => {
    expect(balanceDue(50_000, 50_000)).toBe(0);
    expect(balanceDue(50_000, 60_000)).toBe(0);
  });
  it("is null when no total is recorded", () => {
    expect(balanceDue(null, 5_000)).toBeNull();
    expect(balanceDue(undefined, null)).toBeNull();
  });
});
