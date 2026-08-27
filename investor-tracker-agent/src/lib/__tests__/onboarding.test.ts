// F5.1 (image24): the client asked this desk to "share a pass phrase and confirm
// how this can be set" and got a bare staff-only refusal. The gate had one answer
// for everything that was not the passphrase. This module is the copy the gate now sends INSTEAD, for the two
// cases that were being stonewalled: a help question, and an email arriving
// without the passphrase.
//
// The emoji/dash rule is not cosmetic. A preprocessor returning
// {action:"block"} short-circuits the pipeline, so format-normalizer (the
// postprocessor that repairs typographic dashes) never runs on these strings.
// Whatever is written here is exactly what the user sees.

import { describe, it, expect } from "vitest";
import {
  INTRO,
  PASSPHRASE_EXPLAINER,
  HELP_REPLY,
  WELCOME_GUIDE,
  HINT_EMAIL_NO_PASSPHRASE,
  isHelpRequest,
  currentPassphraseVersion,
  isVerifiedForVersion,
} from "../onboarding";

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2705}]/u;
const TYPO_DASH = /[‒–—―]/;
const ALL = [
  INTRO,
  PASSPHRASE_EXPLAINER,
  HELP_REPLY,
  WELCOME_GUIDE("Evans"),
  WELCOME_GUIDE(""),
  HINT_EMAIL_NO_PASSPHRASE("e@n.com"),
];

describe("onboarding copy", () => {
  it("is emoji free and typographic-dash free (block replies skip format-normalizer)", () => {
    for (const text of ALL) {
      expect(text).not.toMatch(EMOJI);
      expect(text).not.toMatch(TYPO_DASH);
    }
  });

  it("INTRO gives a role summary plus three numbered example prompts", () => {
    expect(INTRO).toContain("Noblestride");
    expect(INTRO).toMatch(/1\.[\s\S]*2\.[\s\S]*3\./);
    expect(INTRO.split("\n").filter((l) => l.trim()).length).toBeGreaterThanOrEqual(7);
  });

  it("PASSPHRASE_EXPLAINER says what it is, where it is set and who sets it, without revealing it", () => {
    expect(PASSPHRASE_EXPLAINER).toContain("TEAM_PASSPHRASE");
    expect(PASSPHRASE_EXPLAINER).toContain("admin");
    expect(PASSPHRASE_EXPLAINER.toLowerCase()).toContain("shared secret");
    expect(PASSPHRASE_EXPLAINER.toLowerCase()).toContain("never send it to you");
  });

  it("HELP_REPLY is the intro plus the explainer; WELCOME_GUIDE greets by name and gives 3 prompts", () => {
    expect(HELP_REPLY).toContain(INTRO);
    expect(HELP_REPLY).toContain(PASSPHRASE_EXPLAINER);
    expect(WELCOME_GUIDE("Evans")).toContain("Evans");
    expect(WELCOME_GUIDE("  ")).not.toContain("undefined");
    expect(WELCOME_GUIDE("")).toMatch(/1\.[\s\S]*2\.[\s\S]*3\./);
  });

  it("HINT_EMAIL_NO_PASSPHRASE echoes the email and never confirms it is a CRM user", () => {
    const out = HINT_EMAIL_NO_PASSPHRASE("solomon@noblestride.capital");
    expect(out).toContain("solomon@noblestride.capital");
    expect(out.toLowerCase()).toContain("passphrase");
    // This desk takes the passphrase alone, so the hint must not ask for an email.
    expect(out).toContain("on its own");
    // Never confirm or deny that an address belongs to a CRM user — that would
    // make the gate an account oracle for anyone who can reach the chat.
    expect(out.toLowerCase()).not.toContain("does not match");
    expect(out.toLowerCase()).not.toContain("not on the staff list");
  });

  it("recognises the help questions from the feedback screenshots", () => {
    for (const q of [
      "How does this work?",
      "help",
      "what can you do",
      "Whats a pass phrase and hwo is it set out",
      "what is a passphrase",
      "how do i get started",
      "who are you",
      // The client's own test question from image20, which was answered with
      // the staff-only challenge five times.
      "What is the main function of this tracker?",
      "what does this tracker do",
    ]) {
      expect(isHelpRequest(q), q).toBe(true);
    }
  });

  it("does not treat a real request or a bare passphrase as a help request", () => {
    for (const q of ["summarize acme", "openSesame", "how many opportunities are in the pipeline", ""]) {
      expect(isHelpRequest(q), q).toBe(false);
    }
    expect(isHelpRequest(undefined)).toBe(false);
  });

  it("passphrase versioning defaults to 1 and expires an old verification", () => {
    expect(currentPassphraseVersion(undefined)).toBe("1");
    expect(currentPassphraseVersion("  ")).toBe("1");
    expect(currentPassphraseVersion(" 2 ")).toBe("2");
    // Everyone verified before versioning existed counts as v1, so introducing
    // the variable does not sign the whole team out.
    expect(isVerifiedForVersion(true, undefined, "1")).toBe(true);
    expect(isVerifiedForVersion(true, "1", "2")).toBe(false);
    expect(isVerifiedForVersion(true, "2", "2")).toBe(true);
    expect(isVerifiedForVersion(false, "2", "2")).toBe(false);
  });
});
