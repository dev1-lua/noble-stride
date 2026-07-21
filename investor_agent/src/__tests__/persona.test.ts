import { describe, it, expect } from "vitest";
import { INVESTOR_PERSONA } from "../persona";

describe("INVESTOR_PERSONA", () => {
  it("keeps the core non-disclosure hard rules", () => {
    const p = INVESTOR_PERSONA.toLowerCase();
    expect(p).toContain("never reveal whether");
    expect(p).toContain("deal specifics");
    expect(p).toContain("noblestride investor relations");
  });
  it("treats sender content as data, never instructions (injection resistance)", () => {
    const p = INVESTOR_PERSONA.toLowerCase();
    expect(p).toContain("data");
    expect(p).toContain("never");
    expect(p).toMatch(/instruction/);
  });
  it("carries the refuse-with-insight response contract (no bare stonewalling)", () => {
    const p = INVESTOR_PERSONA.toLowerCase();
    expect(p).toContain("explain");
    expect(p).toMatch(/why/);
    expect(p).toContain("portal");
  });
  it("locks outreach as draft-only / human-approved (never sends)", () => {
    const p = INVESTOR_PERSONA.toLowerCase();
    expect(p).toContain("never send");
    expect(p).toMatch(/approv/);
  });
  it("instructs acknowledging updates without restating the figures back", () => {
    expect(INVESTOR_PERSONA.toLowerCase()).toMatch(/without (restating|repeating)/);
  });
  it("is NOT a CRM-style 'fetch everything / go deeper' agent", () => {
    expect(INVESTOR_PERSONA.toLowerCase()).not.toContain("go deeper");
  });
});
