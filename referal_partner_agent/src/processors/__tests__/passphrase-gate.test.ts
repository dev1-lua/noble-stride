// F5.6 / image23: "drop the partner usage; partners log in to the portal for
// deal status." This gate used to pass every unverified visitor through in
// "partner mode" so they could reach token-scoped self-service tools. That
// surface is gone, so the gate is now a hard block — and, because a block is
// only fair if it is explicable, it answers help questions and points a partner
// at the portal instead of stonewalling them.

import { describe, it, expect } from "vitest";
import { gateDecision } from "../passphrase-gate";

describe("gateDecision", () => {
  it("verified users always proceed", () => {
    expect(gateDecision(true, "anything", "secret")).toBe("proceed");
    expect(gateDecision(true, undefined, "secret")).toBe("proceed");
  });

  // The gate matches the passphrase case-insensitively and tolerantly of
  // punctuation and surrounding words, so a staff member who wraps it in a
  // sentence still gets in.
  it("matches the passphrase tolerantly of case, punctuation and surrounding words", () => {
    expect(gateDecision(false, "  secret ", "secret")).toBe("verify");
    expect(gateDecision(false, "Secret", "secret")).toBe("verify");
    expect(gateDecision(false, "the passphrase is Secret.", "secret")).toBe("verify");
  });

  it("a partial or near-miss passphrase does not verify", () => {
    expect(gateDecision(false, "secrets", "secret")).toBe("challenge");
    expect(gateDecision(false, "open", "open sesame")).toBe("challenge");
    expect(gateDecision(false, "open sesame", "open sesame")).toBe("verify");
  });

  // ── the retirement of partner mode ────────────────────────────────────────

  it("no longer has a partner mode: an unverified visitor is blocked, not passed through", () => {
    expect(gateDecision(false, "I'd like to check my referrals", "secret")).toBe("challenge");
    expect(gateDecision(false, "verify my partner code 1234", "secret")).toBe("challenge");
    expect(gateDecision(false, "summarize acme", "secret")).toBe("challenge");
    expect(gateDecision(false, undefined, "secret")).toBe("challenge");
  });

  it("fails closed when no passphrase is configured", () => {
    // Previously this let everyone through in partner mode. With no partner
    // surface left, an unconfigured passphrase must admit nobody.
    expect(gateDecision(false, "anything", undefined)).toBe("unconfigured");
    expect(gateDecision(false, "anything", "")).toBe("unconfigured");
    expect(gateDecision(false, "!!!", "!!!")).toBe("unconfigured");
    expect(gateDecision(true, "hi", undefined)).toBe("proceed"); // already-verified staff unaffected
  });

  it("still answers help, and hints when an email arrives instead of a passphrase", () => {
    expect(gateDecision(false, "What can you help me with?", "secret")).toBe("help");
    expect(gateDecision(false, "how does this work", "secret")).toBe("help");
    expect(gateDecision(false, "what is a passphrase", "secret")).toBe("help");
    expect(gateDecision(false, "jane@partner.co", "secret")).toBe("hint_missing_passphrase");
  });

  it("no unverified path ever reaches the tools", () => {
    for (const text of [
      "I'd like to check my referrals",
      "verify my partner code 1234",
      "help",
      "jane@partner.co",
      "secrets",
      undefined,
    ]) {
      expect(gateDecision(false, text, "secret"), String(text)).not.toBe("proceed");
    }
  });

  // 2026-07-21 QA (cross-cutting): staff verification used to be permanent.
  it("verified staff can sign out with an explicit whole-message phrase", () => {
    expect(gateDecision(true, "log out", "secret")).toBe("logout");
    expect(gateDecision(true, "reset to partner mode", "secret")).toBe("logout");
    expect(gateDecision(true, "Exit staff mode!", "secret")).toBe("logout");
  });

  it("mentioning logout inside a longer message does NOT de-verify", () => {
    expect(gateDecision(true, "how do I log out of the portal?", "secret")).toBe("proceed");
    // An unverified visitor has no staff session to end.
    expect(gateDecision(false, "log out", "secret")).toBe("challenge");
  });

  // G5: rotating the passphrase re-challenges existing sessions.
  describe("passphrase rotation", () => {
    it("keeps a session verified under the current generation", () => {
      expect(gateDecision(true, "anything", "secret", "2", "2")).toBe("proceed");
    });

    it("re-challenges a session verified under an older generation", () => {
      expect(gateDecision(true, "anything", "secret", "2", "1")).toBe("challenge");
    });

    it("treats a session from before versioning existed as generation 1", () => {
      expect(gateDecision(true, "anything", "secret", undefined, undefined)).toBe("proceed");
      expect(gateDecision(true, "anything", "secret", "2", undefined)).toBe("challenge");
    });
  });
});
