import { describe, it, expect } from "vitest";
import { formatMoney } from "@/lib/money";

describe("formatMoney", () => {
  it("formats millions", () => expect(formatMoney(18_400_000)).toBe("$18.4M"));
  it("formats thousands", () => expect(formatMoney(680_000)).toBe("$680K"));
  it("formats small", () => expect(formatMoney(500)).toBe("$500"));
  it("handles null", () => expect(formatMoney(null)).toBe(""));
  it("respects currency", () => expect(formatMoney(5_000_000, "USD")).toBe("$5.0M"));
});
