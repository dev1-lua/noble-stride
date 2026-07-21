import { describe, it, expect } from "vitest";
import { gateDecision } from "../passphrase-gate";

describe("gateDecision", () => {
  it("verified users always proceed", () => {
    expect(gateDecision(true, "anything", "secret")).toBe("proceed");
    expect(gateDecision(true, undefined, "secret")).toBe("proceed");
  });

  it("correct passphrase (trimmed, case-sensitive) verifies", () => {
    expect(gateDecision(false, "  secret ", "secret")).toBe("verify");
    expect(gateDecision(false, "Secret", "secret")).toBe("challenge");
  });

  it("anything else is challenged", () => {
    expect(gateDecision(false, "summarize acme", "secret")).toBe("challenge");
    expect(gateDecision(false, undefined, "secret")).toBe("challenge");
  });

  it("missing TEAM_PASSPHRASE fails closed", () => {
    expect(gateDecision(false, "secret", undefined)).toBe("unconfigured");
    expect(gateDecision(false, "anything", "")).toBe("unconfigured"); // empty-string env is unconfigured too
    expect(gateDecision(false, "", "")).toBe("unconfigured");
    expect(gateDecision(true, "hi", undefined)).toBe("proceed"); // already-verified users unaffected
  });

  // 2026-07-21 QA (cross-cutting): verification used to be permanent.
  it("a verified user can log out with an explicit whole-message logout phrase", () => {
    expect(gateDecision(true, "log out", "secret")).toBe("logout");
    expect(gateDecision(true, "Logout!", "secret")).toBe("logout");
    expect(gateDecision(true, "exit staff mode", "secret")).toBe("logout");
    expect(gateDecision(true, "reset my verification", "secret")).toBe("logout");
  });

  it("mentioning logout inside a longer message does NOT de-verify", () => {
    expect(gateDecision(true, "how do I log out of the CRM?", "secret")).toBe("proceed");
    expect(gateDecision(false, "log out", "secret")).toBe("challenge"); // unverified users have nothing to log out of
  });
});
