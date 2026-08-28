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

// ── F5.1 (image24): "share a pass phrase and confirm how this can be set" ────
//
// The client asked this desk what a passphrase is and how it gets set, and the
// gate answered with the staff-only refusal. It now answers the question. None
// of these paths verify anybody.
describe("first contact no longer refuses a fair question (F5.1)", () => {
  it("explains itself when asked, instead of repeating the refusal", () => {
    for (const question of [
      "help",
      "How does this work?",
      "what can you do",
      "what is a passphrase",
      "Whats a pass phrase and hwo is it set out",
      "how is the passphrase set",
      "who are you",
    ]) {
      expect(gateDecision(false, question, "secret"), question).toBe("help");
    }
  });

  it("acknowledges an email and says what this desk actually needs", () => {
    expect(gateDecision(false, "solomon@noblestride.capital", "secret")).toBe("hint_missing_passphrase");
  });

  it("neither help nor the email hint ever opens the gate", () => {
    for (const text of ["help", "who are you", "solomon@noblestride.capital"]) {
      const outcome = gateDecision(false, text, "secret");
      expect(outcome).not.toBe("proceed");
      expect(outcome).not.toBe("verify");
    }
  });

  it("a real request is still challenged rather than answered with the guide", () => {
    expect(gateDecision(false, "what needs chasing", "secret")).toBe("challenge");
    expect(gateDecision(false, "where does Vantage stand", "secret")).toBe("challenge");
  });
});

// G5: rotating the passphrase must re-challenge existing sessions.
describe("passphrase rotation (G5)", () => {
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
