import { describe, it, expect } from "vitest";
import { GLOSSARY, define } from "@/lib/glossary";

describe("glossary", () => {
  it("has 16 entries", () => {
    expect(GLOSSARY).toHaveLength(16);
  });

  it("every entry has a non-empty term and definition", () => {
    for (const entry of GLOSSARY) {
      expect(entry.term.length).toBeGreaterThan(0);
      expect(entry.definition.length).toBeGreaterThan(0);
    }
  });

  it("define() hits an exact-match term", () => {
    expect(define("Mandate")).toBe(
      "The assignment a client hires NobleStride for — one fundraising or advisory engagement, opened when the engagement contract is signed."
    );
  });

  it("define() hits a multi-word term", () => {
    expect(define("Investor Engagement")).toBe(
      "One investor's conversation on one deal — from first share to term sheet, NDA and investment."
    );
  });

  it("define() is case-insensitive", () => {
    expect(define("vdr")).toBe(define("VDR"));
    expect(define("open nda")).toBe(define("Open NDA"));
  });

  it("define() misses an unknown term", () => {
    expect(define("Nonexistent Term")).toBeUndefined();
  });

  it("define() misses an empty string", () => {
    expect(define("")).toBeUndefined();
  });
});
