import { describe, it, expect } from "vitest";
import { initials } from "@/components/ui/avatar";

describe("initials()", () => {
  it("returns first letter of a single name", () => {
    expect(initials("Alice")).toBe("A");
  });

  it("returns first letters of first two words", () => {
    expect(initials("John Doe")).toBe("JD");
  });

  it("only uses first two words for multi-word names", () => {
    expect(initials("Mary Jane Watson")).toBe("MJ");
  });

  it("handles leading/trailing whitespace", () => {
    expect(initials("  Bob   Smith  ")).toBe("BS");
  });

  it("returns uppercase letters", () => {
    expect(initials("alice bob")).toBe("AB");
  });

  it("returns ? for empty string", () => {
    expect(initials("")).toBe("?");
  });

  it("returns ? for whitespace-only string", () => {
    expect(initials("   ")).toBe("?");
  });
});
