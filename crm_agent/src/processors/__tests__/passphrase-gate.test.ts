import { describe, it, expect, vi } from "vitest";
import {
  gateDecision,
  runGate,
  extractCredentials,
  STAFF_COLLECTION,
  type GateDeps,
  type GateState,
} from "../passphrase-gate";

const PASS = "secret";
const unverifiedState = { verified: false };

describe("gateDecision", () => {
  it("fully identified users (verified + staffEmail) always proceed", () => {
    expect(gateDecision({ verified: true, staffEmail: "evans@noblestride.com" }, "anything", "secret")).toBe(
      "proceed",
    );
    expect(gateDecision({ verified: true, staffEmail: "evans@noblestride.com" }, undefined, "secret")).toBe(
      "proceed",
    );
  });

  // The server-side gate (v1.0.11) matches the passphrase case-insensitively and
  // tolerantly of punctuation and surrounding words, so a staff member typing
  // "Passphrase: Secret!" is not turned away over a capital letter. What it will
  // NOT do is match a partial or fuzzy version of the phrase itself.
  it("matches the passphrase tolerantly of case, punctuation and surrounding words", () => {
    expect(gateDecision({ verified: false }, "  secret ", "secret")).toBe("verify");
    expect(gateDecision({ verified: false }, "Secret", "secret")).toBe("verify");
    expect(gateDecision({ verified: false }, "Passphrase: Secret!", "secret")).toBe("verify");
    expect(gateDecision({ verified: false }, "hi, the passphrase is secret", "secret")).toBe("verify");
  });

  it("does not accept a partial or near-miss passphrase", () => {
    expect(gateDecision({ verified: false }, "secrets", "secret")).toBe("challenge");
    expect(gateDecision({ verified: false }, "sec", "secret")).toBe("challenge");
    expect(gateDecision({ verified: false }, "open", "open sesame")).toBe("challenge");
    expect(gateDecision({ verified: false }, "open sesame", "open sesame")).toBe("verify");
  });

  // A passphrase of nothing but punctuation normalizes to empty, which must fail
  // closed like an unset one rather than looking like a live, unguessable secret.
  it("treats a punctuation-only passphrase as unconfigured", () => {
    expect(gateDecision({ verified: false }, "!!!", "!!!")).toBe("unconfigured");
    expect(gateDecision({ verified: false }, "anything", "   ")).toBe("unconfigured");
  });

  it("anything else is challenged", () => {
    expect(gateDecision({ verified: false }, "summarize acme", "secret")).toBe("challenge");
    expect(gateDecision({ verified: false }, undefined, "secret")).toBe("challenge");
  });

  it("missing TEAM_PASSPHRASE fails closed", () => {
    expect(gateDecision({ verified: false }, "secret", undefined)).toBe("unconfigured");
    expect(gateDecision({ verified: false }, "anything", "")).toBe("unconfigured"); // empty-string env is unconfigured too
    expect(gateDecision({ verified: false }, "", "")).toBe("unconfigured");
    expect(gateDecision({ verified: true, staffEmail: "evans@noblestride.com" }, "hi", undefined)).toBe("proceed"); // already fully-identified users unaffected
  });

  it("verified without a staffEmail asks for one, unless the reply already looks like an email", () => {
    expect(gateDecision({ verified: true }, "not an email", "secret")).toBe("ask_email");
    expect(gateDecision({ verified: true }, undefined, "secret")).toBe("ask_email");
    expect(gateDecision({ verified: true }, "evans@noblestride.com", "secret")).toBe("try_identify");
    expect(gateDecision({ verified: true }, "  evans@noblestride.com  ", "secret")).toBe("try_identify");
  });

  // 2026-07-21 QA (cross-cutting): verification used to be permanent.
  it("a verified user can log out with an explicit whole-message logout phrase", () => {
    expect(gateDecision({ verified: true, staffEmail: "evans@noblestride.com" }, "log out", "secret")).toBe("logout");
    expect(gateDecision({ verified: true, staffEmail: "evans@noblestride.com" }, "Logout!", "secret")).toBe("logout");
    expect(gateDecision({ verified: true }, "exit staff mode", "secret")).toBe("logout");
    expect(gateDecision({ verified: true, staffEmail: "e@n.com" }, "reset my verification", "secret")).toBe("logout");
  });

  it("mentioning logout inside a longer message does NOT de-verify", () => {
    expect(gateDecision({ verified: true, staffEmail: "e@n.com" }, "how do I log out of the CRM?", "secret")).toBe(
      "proceed",
    );
    expect(gateDecision({ verified: false }, "log out", "secret")).toBe("challenge"); // unverified users have nothing to log out of
  });
});

function fakeDeps(overrides: Partial<GateDeps> = {}): GateDeps {
  return {
    data: {
      get: vi.fn(async () => ({ data: [], pagination: {} })) as unknown as GateDeps["data"]["get"],
      create: vi.fn(async () => ({}) as never) as unknown as GateDeps["data"]["create"],
    },
    passphrase: "secret",
    resolveStaff: vi.fn(async () => ({ ok: true, firstName: "Evans" })),
    updateUser: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("runGate", () => {
  it("proceeds without side effects once verified + identified", async () => {
    const deps = fakeDeps();
    const result = await runGate(deps, { verified: true, staffEmail: "evans@noblestride.com" }, "summarize acme", "u1");
    expect(result).toEqual({ action: "proceed" });
    expect(deps.updateUser).not.toHaveBeenCalled();
    expect(deps.resolveStaff).not.toHaveBeenCalled();
  });

  it("challenges an unverified user with the wrong text", async () => {
    const deps = fakeDeps();
    const result = await runGate(deps, { verified: false }, "nope", "u1");
    expect(result.action).toBe("block");
    if (result.action === "block") expect(result.response).toMatch(/passphrase/i);
  });

  it("fails closed when the passphrase is unconfigured", async () => {
    const deps = fakeDeps({ passphrase: undefined });
    const result = await runGate(deps, { verified: false }, "secret", "u1");
    expect(result.action).toBe("block");
    if (result.action === "block") expect(result.response).toMatch(/isn't fully configured/i);
  });

  it("on correct passphrase, verifies the user and registers them once in staff_users", async () => {
    const deps = fakeDeps();
    const result = await runGate(deps, { verified: false }, "secret", "u1");
    expect(deps.updateUser).toHaveBeenCalledWith({ verified: true, passphraseVersion: "1" });
    expect(deps.data.create).toHaveBeenCalledWith(STAFF_COLLECTION, { userId: "u1" });
    expect(result.action).toBe("block");
    if (result.action === "block") expect(result.response).toMatch(/verified/i);
  });

  it("does not re-register an already-known staff user", async () => {
    const deps = fakeDeps({
      data: {
        get: vi.fn(async () => ({ data: [{ data: { userId: "u1" } }], pagination: {} })) as unknown as GateDeps["data"]["get"],
        create: vi.fn(async () => ({}) as never) as unknown as GateDeps["data"]["create"],
      },
    });
    await runGate(deps, { verified: false }, "secret", "u1");
    expect(deps.data.create).not.toHaveBeenCalled();
  });

  it("logout clears verified + staffEmail + staffName and blocks with a signed-out message", async () => {
    const deps = fakeDeps();
    const result = await runGate(deps, { verified: true, staffEmail: "evans@noblestride.com" }, "log out", "u1");
    expect(result.action).toBe("block");
    if (result.action === "block") expect(result.response).toMatch(/signed out/i);
    expect(deps.updateUser).toHaveBeenCalledWith({ verified: false, staffEmail: null, staffName: null, passphraseVersion: null });
  });

  it("asks a verified-but-unidentified user for their CRM email", async () => {
    const deps = fakeDeps();
    const result = await runGate(deps, { verified: true }, "hi there", "u1");
    expect(result.action).toBe("block");
    if (result.action === "block") {
      expect(result.response).toBe(
        "Passphrase accepted. To act on your behalf in the CRM I also need your CRM login email. What is it?",
      );
    }
    expect(deps.resolveStaff).not.toHaveBeenCalled();
  });

  it("try_identify: resolveStaff success stores staffEmail/staffName and welcomes by name", async () => {
    const deps = fakeDeps({ resolveStaff: vi.fn(async () => ({ ok: true, firstName: "Evans" })) });
    const result = await runGate(deps, { verified: true }, "evans@noblestride.com", "u1");
    expect(deps.resolveStaff).toHaveBeenCalledWith("evans@noblestride.com");
    expect(deps.updateUser).toHaveBeenCalledWith({ staffEmail: "evans@noblestride.com", staffName: "Evans" });
    expect(result.action).toBe("block");
    if (result.action === "block") expect(result.response).toContain("Evans");
  });

  it("try_identify: resolveStaff ok:false blocks without updating the user", async () => {
    const deps = fakeDeps({ resolveStaff: vi.fn(async () => ({ ok: false, firstName: null })) });
    const result = await runGate(deps, { verified: true }, "unknown@noblestride.com", "u1");
    expect(deps.updateUser).not.toHaveBeenCalled();
    expect(result.action).toBe("block");
    if (result.action === "block") expect(result.response).toMatch(/could not match that email/i);
  });

  it("try_identify: CRM transport failure blocks with a retry message and no update", async () => {
    const deps = fakeDeps({ resolveStaff: vi.fn(async () => { throw new Error("network down"); }) });
    const result = await runGate(deps, { verified: true }, "evans@noblestride.com", "u1");
    expect(deps.updateUser).not.toHaveBeenCalled();
    expect(result.action).toBe("block");
    if (result.action === "block") expect(result.response).toMatch(/cannot check your email right now/i);
  });

  it("verify_and_identify: resolveStaff success verifies, stores staffEmail/staffName, and welcomes in one message", async () => {
    const deps = fakeDeps({ resolveStaff: vi.fn(async () => ({ ok: true, firstName: "Jane" })) });
    const result = await runGate(deps, { verified: false }, `${PASS} jane@noblestride.capital`, "u1");
    expect(deps.updateUser).toHaveBeenCalledWith({ verified: true, passphraseVersion: "1" });
    expect(deps.data.create).toHaveBeenCalledWith(STAFF_COLLECTION, { userId: "u1" });
    expect(deps.resolveStaff).toHaveBeenCalledWith("jane@noblestride.capital");
    expect(deps.updateUser).toHaveBeenCalledWith({ staffEmail: "jane@noblestride.capital", staffName: "Jane" });
    expect(result.action).toBe("block");
    if (result.action === "block") {
      expect(result.response).toMatch(/verified/i);
      expect(result.response).toContain("Jane");
    }
  });

  it("verify_and_identify: resolveStaff ok:false still verifies but blocks with IDENTIFY_FAIL", async () => {
    const deps = fakeDeps({ resolveStaff: vi.fn(async () => ({ ok: false, firstName: null })) });
    const result = await runGate(deps, { verified: false }, `${PASS} unknown@noblestride.capital`, "u1");
    expect(deps.updateUser).toHaveBeenCalledWith({ verified: true, passphraseVersion: "1" });
    expect(deps.updateUser).not.toHaveBeenCalledWith(expect.objectContaining({ staffEmail: expect.anything() }));
    expect(result.action).toBe("block");
    if (result.action === "block") expect(result.response).toMatch(/could not match that email/i);
  });

  it("verify_and_identify: CRM transport failure still verifies but blocks with IDENTIFY_ERROR", async () => {
    const deps = fakeDeps({ resolveStaff: vi.fn(async () => { throw new Error("network down"); }) });
    const result = await runGate(deps, { verified: false }, `${PASS} jane@noblestride.capital`, "u1");
    expect(deps.updateUser).toHaveBeenCalledWith({ verified: true, passphraseVersion: "1" });
    expect(result.action).toBe("block");
    if (result.action === "block") expect(result.response).toMatch(/cannot check your email right now/i);
  });
});

describe("combined passphrase + email", () => {
  it("verifies and identifies from a single 'passphrase email' message", () => {
    expect(gateDecision(unverifiedState, `${PASS} jane@noblestride.capital`, PASS)).toBe("verify_and_identify");
  });
  it("accepts 'email passphrase' order too", () => {
    expect(gateDecision(unverifiedState, `jane@noblestride.capital ${PASS}`, PASS)).toBe("verify_and_identify");
  });
  it("still verifies passphrase-only reply and then asks for email", () => {
    expect(gateDecision(unverifiedState, PASS, PASS)).toBe("verify");
  });
  // F5.1: an email with no passphrase is a near-miss, not a stranger. It does
  // NOT verify anyone; it gets an acknowledgement plus what is still needed,
  // instead of the identical challenge the client saw five times.
  it("answers an email-only reply with the missing-passphrase hint, not the challenge", () => {
    expect(gateDecision(unverifiedState, "jane@noblestride.capital", PASS)).toBe("hint_missing_passphrase");
    expect(gateDecision(unverifiedState, "nope jane@noblestride.capital", PASS)).toBe("hint_missing_passphrase");
  });

  it("still refuses to verify on a wrong passphrase, with or without an email", () => {
    for (const text of ["nope jane@noblestride.capital", "nope", "jane@noblestride.capital"]) {
      const outcome = gateDecision(unverifiedState, text, PASS);
      expect(outcome).not.toBe("verify");
      expect(outcome).not.toBe("verify_and_identify");
      expect(outcome).not.toBe("proceed");
    }
  });
});

describe("extractCredentials", () => {
  it("pulls the first email token and returns the rest", () => {
    expect(extractCredentials("open sesame jane@x.co")).toEqual({ email: "jane@x.co", rest: "open sesame" });
  });
  it("strips trailing punctuation from the email", () => {
    expect(extractCredentials(`${"secret"} jane@x.co.`).email).toBe("jane@x.co");
  });
  it("returns null email when none present", () => {
    expect(extractCredentials("just words")).toEqual({ email: null, rest: "just words" });
  });
});

// ── F5.1: the loop the client screenshotted five times ──────────────────────
//
// image19/image20: a first-time user asks how the assistant works and gets the
// staff-only challenge back, over and over. These tests are the regression: the
// gate must answer the question, and must acknowledge an email that arrives
// without the passphrase, without ever letting either past the gate.
describe("first contact no longer loops (F5.1)", () => {
  const unverified: GateState = { verified: false };

  it("answers the exact questions from the feedback screenshots", async () => {
    for (const question of [
      "How does this work?",
      "What can you do?",
      "Whats a pass phrase and hwo is it set out",
      "help",
      "who are you",
    ]) {
      expect(gateDecision(unverified, question, PASS), question).toBe("help");
      const deps = fakeDeps();
      const result = await runGate(deps, unverified, question, "u1");
      expect(result.action).toBe("block");
      if (result.action === "block") {
        // The reply explains the assistant AND where the passphrase comes from.
        expect(result.response).toContain("Noblestride CRM assistant");
        expect(result.response).toContain("TEAM_PASSPHRASE");
        expect(result.response).not.toContain("staff only.");
      }
      // Asking for help neither verifies nor records anything.
      expect(deps.updateUser).not.toHaveBeenCalled();
      expect(deps.data.create).not.toHaveBeenCalled();
      expect(deps.resolveStaff).not.toHaveBeenCalled();
    }
  });

  it("the client's own test message gets an answer, not a challenge", async () => {
    // "whats the main function of this CRM solomon@noblestride.capital" —
    // a help question with an email attached. The help branch wins, and the
    // reply must not confirm anything about that address.
    const message = "whats the main function of this CRM solomon@noblestride.capital";
    expect(gateDecision(unverified, message, PASS)).toBe("help");
    const result = await runGate(fakeDeps(), unverified, message, "u1");
    if (result.action === "block") {
      expect(result.response).not.toContain("solomon@noblestride.capital");
    }
  });

  it("an email without the passphrase is acknowledged, not stonewalled", async () => {
    const deps = fakeDeps();
    const result = await runGate(deps, unverified, "solomon@noblestride.capital", "u1");
    expect(result.action).toBe("block");
    if (result.action === "block") {
      expect(result.response).toContain("solomon@noblestride.capital");
      expect(result.response.toLowerCase()).toContain("passphrase");
    }
    // Echoing the address must not verify the person or look it up in the CRM.
    expect(deps.updateUser).not.toHaveBeenCalled();
    expect(deps.resolveStaff).not.toHaveBeenCalled();
  });

  it("no help reply ever opens the gate", async () => {
    for (const question of ["help", "how does this work", "who are you"]) {
      const result = await runGate(fakeDeps(), unverified, question, "u1");
      expect(result.action).toBe("block");
    }
  });
});

// G5: rotating TEAM_PASSPHRASE used to protect nobody — anyone already verified
// stayed verified forever. Bumping PASSPHRASE_VERSION alongside it re-challenges.
describe("passphrase rotation (G5)", () => {
  it("keeps sessions verified under the current generation", () => {
    expect(gateDecision({ verified: true, passphraseVersion: "2" }, "anything", PASS, "2")).toBe("ask_email");
  });

  it("re-challenges a session verified under an older generation", () => {
    expect(gateDecision({ verified: true, passphraseVersion: "1" }, "anything", PASS, "2")).toBe("challenge");
  });

  it("treats a session from before versioning existed as generation 1", () => {
    expect(gateDecision({ verified: true }, "anything", PASS, undefined)).toBe("ask_email");
    expect(gateDecision({ verified: true }, "anything", PASS, "1")).toBe("ask_email");
    expect(gateDecision({ verified: true }, "anything", PASS, "2")).toBe("challenge");
  });

  it("stamps the generation when it verifies someone", async () => {
    const deps = fakeDeps({ passphraseVersion: "3" });
    await runGate(deps, { verified: false }, PASS, "u1");
    expect(deps.updateUser).toHaveBeenCalledWith({ verified: true, passphraseVersion: "3" });
  });
});

// Block replies short-circuit the pipeline, so format-normalizer never sees
// them. Anything with an emoji or a typographic dash reaches the user as-is.
describe("every block reply is emoji free and dash free", () => {
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2705}]/u;
  const TYPO_DASH = /[‒–—―]/;

  it("across every outcome the gate can return", async () => {
    const cases: Array<[GateState, string | undefined, GateDeps]> = [
      [{ verified: false }, "hello there", fakeDeps()],
      [{ verified: false }, "help", fakeDeps()],
      [{ verified: false }, "jane@noblestride.capital", fakeDeps()],
      [{ verified: false }, PASS, fakeDeps()],
      [{ verified: false }, "anything", fakeDeps({ passphrase: undefined })],
      [{ verified: true }, "anything", fakeDeps()],
      [{ verified: true }, "log out", fakeDeps()],
      [
        { verified: true },
        "unknown@noblestride.capital",
        fakeDeps({ resolveStaff: vi.fn(async () => ({ ok: false, firstName: null })) }),
      ],
      [
        { verified: true },
        "boom@noblestride.capital",
        fakeDeps({
          resolveStaff: vi.fn(async () => {
            throw new Error("network down");
          }),
        }),
      ],
      [
        { verified: false },
        `${PASS} jane@noblestride.capital`,
        fakeDeps({ resolveStaff: vi.fn(async () => ({ ok: true, firstName: "Jane" })) }),
      ],
    ];

    for (const [state, text, deps] of cases) {
      const result = await runGate(deps, state, text, "u1");
      if (result.action === "block") {
        expect(result.response, result.response).not.toMatch(EMOJI);
        expect(result.response, result.response).not.toMatch(TYPO_DASH);
      }
    }
  });
});
