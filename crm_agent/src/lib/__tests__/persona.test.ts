import { describe, it, expect } from "vitest";
import { CRM_PERSONA } from "../../persona";

describe("CRM_PERSONA", () => {
  it("keeps the internal-only, staff-only guardrails", () => {
    expect(CRM_PERSONA).toContain("internal");
    expect(CRM_PERSONA).toContain("Noblestride staff only");
  });
  it("keeps the no-invented-facts and no-raw-id rules", () => {
    expect(CRM_PERSONA.toLowerCase()).toContain("never invent");
    expect(CRM_PERSONA.toLowerCase()).toContain("deep link");
  });
  it("keeps the write/delete/external-send boundaries", () => {
    expect(CRM_PERSONA.toLowerCase()).toContain("propose");
    expect(CRM_PERSONA.toLowerCase()).toContain("never delete");
    expect(CRM_PERSONA.toLowerCase()).toContain("external");
  });
});

describe("CRM_PERSONA — overhaul additions", () => {
  it("teaches the mandate→transaction→engagement→milestone model", () => {
    const p = CRM_PERSONA.toLowerCase();
    expect(p).toContain("mandate");
    expect(p).toContain("transaction");
    expect(p).toContain("engagement");
    expect(p).toContain("milestone");
  });
  it("has an explain-the-boundary rule (no bare refusals)", () => {
    expect(CRM_PERSONA.toLowerCase()).toContain("explain");
    expect(CRM_PERSONA).toMatch(/boundary|boundaries/i);
  });
  it("scopes 'never refuse' so it cannot override safety rules", () => {
    const p = CRM_PERSONA.toLowerCase();
    expect(p).toContain("never refuse");
    // the scope caveat must sit near the never-refuse line
    expect(p).toMatch(/never refuse[\s\S]{0,400}(rbac|propose|delete|external|governance)/);
  });
  it("carries the response contract: categorize, insight, tailored deeper offer", () => {
    const p = CRM_PERSONA.toLowerCase();
    expect(p).toContain("insight");
    expect(p).toContain("go deeper");
    expect(p).toContain("only when");   // depth offer only when more exists
    expect(p).toContain("vary");        // varied phrasing, not boilerplate
  });
  it("resists prompt injection from pasted content", () => {
    const p = CRM_PERSONA.toLowerCase();
    expect(p).toContain("pasted");
    expect(p).toContain("data to analyze");
  });
});
