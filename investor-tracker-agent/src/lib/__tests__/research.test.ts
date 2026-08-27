// A4 / F5.2. Two boundaries are worth testing and the search itself is not one
// of them: what leaves Noblestride, and whether the reader can tell public
// material from CRM material.

import { describe, it, expect } from "vitest";
import {
  buildResearchPrompt,
  shapeResearch,
  isConfidentialLeak,
  PUBLIC_LABEL,
  NO_PUBLIC_INFO_MARKER,
} from "../research";

describe("buildResearchPrompt", () => {
  it("asks only about the public entity and forbids CRM framing", () => {
    const p = buildResearchPrompt({ name: "Acme Ltd", kind: "company", focus: "recent news" });
    expect(p).toContain("Acme Ltd");
    expect(p).toContain("recent news");
    expect(p.toLowerCase()).toContain("publicly available");
    expect(p).toContain(NO_PUBLIC_INFO_MARKER);
  });

  it("never embeds the CRM's own vocabulary in the query", () => {
    // The query is the thing that leaves, so it must not say who is asking or why.
    const p = buildResearchPrompt({ name: "Acme Ltd", kind: "company" });
    expect(p.toLowerCase()).not.toContain("mandate");
    expect(p.toLowerCase()).not.toContain("noblestride");
  });
});

describe("isConfidentialLeak", () => {
  it("catches deal codenames and money amounts a staff member might paste in", () => {
    expect(isConfidentialLeak("Project Ivory Oryx")).toBe(true);
    expect(isConfidentialLeak("raising USD 4,500,000")).toBe(true);
    expect(isConfidentialLeak("$4.5m target raise")).toBe(true);
    expect(isConfidentialLeak("12 million")).toBe(true);
  });

  it("passes plain entity names and topics", () => {
    expect(isConfidentialLeak("Acme Ltd")).toBe(false);
    expect(isConfidentialLeak("recent news")).toBe(false);
    expect(isConfidentialLeak("Vantage Mezzanine")).toBe(false);
    expect(isConfidentialLeak("leadership")).toBe(false);
  });
});

describe("shapeResearch", () => {
  it("labels every successful brief as public web information", () => {
    const out = shapeResearch("Acme opened a Nairobi plant in June 2026.", [
      { sourceType: "url", id: "1", url: "https://example.com/a", title: "Acme opens plant" },
    ]);
    expect(out.status).toBe("ok");
    expect(out.label).toBe(PUBLIC_LABEL);
    expect(out.sources).toEqual([{ url: "https://example.com/a", title: "Acme opens plant" }]);
  });

  it("reports no_public_info on the marker or on empty text", () => {
    expect(shapeResearch(NO_PUBLIC_INFO_MARKER, []).status).toBe("no_public_info");
    expect(shapeResearch("   ", undefined).status).toBe("no_public_info");
  });

  it("reports no_public_info when the model wrote prose but produced no sources", () => {
    // Unsourced prose is the model's prior, which is precisely what F5.2 must
    // not deliver as "public information".
    const out = shapeResearch("Acme is probably doing well.", []);
    expect(out.status).toBe("no_public_info");
    expect(out.brief).toBeNull();
  });

  it("drops sources with no usable url and keeps a missing title as null", () => {
    const out = shapeResearch("Something sourced.", [
      { sourceType: "url", id: "1", url: "https://example.com/a" },
      { sourceType: "url", id: "2", url: "" },
    ]);
    expect(out.sources).toEqual([{ url: "https://example.com/a", title: null }]);
  });
});
