import { describe, expect, it } from "vitest";
import { classifyEmail, normalizeEmail, INTERNAL_EMAIL_DOMAIN } from "../guardrails";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Evans@NobleStride.Capital ")).toBe("evans@noblestride.capital");
  });
});

describe("classifyEmail", () => {
  it("classifies @noblestride.capital as internal (case-insensitive)", () => {
    expect(classifyEmail("evans@noblestride.capital")).toEqual({ kind: "internal" });
    expect(classifyEmail("Solomon@NOBLESTRIDE.CAPITAL")).toEqual({ kind: "internal" });
  });
  it("does NOT treat other noblestride TLDs as internal (tightens old @noblestride.* regex)", () => {
    expect(classifyEmail("x@noblestride.com")).toEqual({ kind: "external" });
  });
  it("classifies corporate emails as external", () => {
    expect(classifyEmail("jane@acmefund.com")).toEqual({ kind: "external" });
  });
  it("blocks free providers", () => {
    expect(classifyEmail("jane@gmail.com")).toEqual({ kind: "blocked", reason: "free-provider" });
    expect(classifyEmail("jane@yahoo.com")).toEqual({ kind: "blocked", reason: "free-provider" });
    expect(classifyEmail("jane@outlook.com")).toEqual({ kind: "blocked", reason: "free-provider" });
  });
  it("blocks malformed emails", () => {
    expect(classifyEmail("not-an-email")).toEqual({ kind: "blocked", reason: "invalid" });
    expect(classifyEmail("@nodomain")).toEqual({ kind: "blocked", reason: "invalid" });
  });
  it("exports the exact internal domain", () => {
    expect(INTERNAL_EMAIL_DOMAIN).toBe("noblestride.capital");
  });
});
