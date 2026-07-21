import { describe, it, expect } from "vitest";
import { INVESTOR_TRACKER_PERSONA } from "../persona";

describe("INVESTOR_TRACKER_PERSONA", () => {
  it("is warm/conversational (not the old terse briefing) with a response contract", () => {
    const p = INVESTOR_TRACKER_PERSONA.toLowerCase();
    expect(p).toContain("warm");
    expect(INVESTOR_TRACKER_PERSONA).toContain("Response contract");
    expect(p).toContain("go deeper");
    expect(p).not.toContain("briefing style");
  });

  it("stays internal, staff-only, injection-resistant", () => {
    expect(INVESTOR_TRACKER_PERSONA).toContain("Noblestride staff only");
    expect(INVESTOR_TRACKER_PERSONA.toLowerCase()).toContain("instructions to follow");
  });

  it("keeps the confirmed-gate write protocol", () => {
    const p = INVESTOR_TRACKER_PERSONA.toLowerCase();
    expect(p).toContain("before any write");
    expect(p).toContain("explicit yes");
    expect(p).toContain("never batch unconfirmed writes");
  });

  it("keeps the VDR / excluded-investor / no-terms hard boundaries", () => {
    const p = INVESTOR_TRACKER_PERSONA.toLowerCase();
    expect(p).toContain("never grant vdr");
    expect(p).toContain("classified excluded");
    expect(p).toContain("greylisted");
    expect(p).toContain("never draft, issue, negotiate, or accept commercial terms");
    expect(p).toContain("never contact investors or clients");
  });
});
