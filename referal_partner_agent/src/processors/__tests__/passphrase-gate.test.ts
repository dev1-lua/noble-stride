import { describe, it, expect } from "vitest";
import { gateDecision } from "../passphrase-gate";

describe("gateDecision", () => {
  it("verified users always proceed", () => {
    expect(gateDecision(true, "anything", "secret")).toBe("proceed");
    expect(gateDecision(true, undefined, "secret")).toBe("proceed");
  });

  it("correct passphrase (trimmed, case-sensitive) verifies as staff", () => {
    expect(gateDecision(false, "  secret ", "secret")).toBe("verify");
    // wrong case is NOT the passphrase → falls through to partner mode (not blocked)
    expect(gateDecision(false, "Secret", "secret")).toBe("partner");
  });

  it("a non-staff message proceeds in partner mode (never hard-blocked)", () => {
    expect(gateDecision(false, "summarize acme", "secret")).toBe("partner");
    expect(gateDecision(false, undefined, "secret")).toBe("partner");
    expect(gateDecision(false, "I'd like to check my referrals", "secret")).toBe("partner");
  });

  it("with no TEAM_PASSPHRASE configured, staff can't verify but partners still proceed", () => {
    expect(gateDecision(false, "secret", undefined)).toBe("partner");
    expect(gateDecision(false, "anything", "")).toBe("partner"); // empty-string env can't verify anyone
    expect(gateDecision(false, "", "")).toBe("partner");
    expect(gateDecision(true, "hi", undefined)).toBe("proceed"); // already-verified staff unaffected
  });
});
