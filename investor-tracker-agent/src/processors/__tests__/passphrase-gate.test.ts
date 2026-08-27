import { describe, it, expect } from "vitest";
import { gateDecision } from "../passphrase-gate";

describe("gateDecision", () => {
  it("verified users always proceed", () => {
    expect(gateDecision(true, "anything", "secret")).toBe("proceed");
    expect(gateDecision(true, undefined, "secret")).toBe("proceed");
  });

  // The server-side gate (v1.0.11) matches the passphrase case-insensitively and
  // tolerantly of punctuation and surrounding words, so a staff member who types
  // "the passphrase is Secret" is not turned away. Partial or near-miss phrases
  // are still refused.
  it("matches the passphrase tolerantly of case, punctuation and surrounding words", () => {
    expect(gateDecision(false, "  secret ", "secret")).toBe("verify");
    expect(gateDecision(false, "Secret", "secret")).toBe("verify");
    expect(gateDecision(false, "the passphrase is Secret.", "secret")).toBe("verify");
  });

  it("does not accept a partial or near-miss passphrase", () => {
    expect(gateDecision(false, "secrets", "secret")).toBe("challenge");
    expect(gateDecision(false, "open", "open sesame")).toBe("challenge");
    expect(gateDecision(false, "open sesame", "open sesame")).toBe("verify");
  });

  it("treats a punctuation-only passphrase as unconfigured", () => {
    expect(gateDecision(false, "!!!", "!!!")).toBe("unconfigured");
    expect(gateDecision(false, "anything", "   ")).toBe("unconfigured");
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
