import { describe, it, expect } from "vitest";
import { formatCompact, formatDate } from "@/lib/format";

describe("format", () => {
  it("compacts thousands", () => expect(formatCompact(1247)).toBe("1,247"));
  it("formats date", () => expect(formatDate(new Date("2026-06-19T00:00:00Z"))).toBe("19 Jun 2026"));
  it("null date -> empty", () => expect(formatDate(null)).toBe(""));
});
