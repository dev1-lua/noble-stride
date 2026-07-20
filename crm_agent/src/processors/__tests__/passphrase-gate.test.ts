import { describe, it, expect, vi } from "vitest";
import { gateDecision, runGate, extractCredentials, STAFF_COLLECTION, type GateDeps } from "../passphrase-gate";

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

  it("correct passphrase (trimmed, case-sensitive) verifies", () => {
    expect(gateDecision({ verified: false }, "  secret ", "secret")).toBe("verify");
    expect(gateDecision({ verified: false }, "Secret", "secret")).toBe("challenge");
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
    expect(deps.updateUser).toHaveBeenCalledWith({ verified: true });
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

  it("asks a verified-but-unidentified user for their CRM email", async () => {
    const deps = fakeDeps();
    const result = await runGate(deps, { verified: true }, "hi there", "u1");
    expect(result.action).toBe("block");
    if (result.action === "block") {
      expect(result.response).toBe(
        "✅ Passphrase accepted. To act on your behalf in the CRM I also need your CRM email — what is it?",
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
    if (result.action === "block") expect(result.response).toMatch(/doesn't match an active CRM user/i);
  });

  it("try_identify: CRM transport failure blocks with a retry message and no update", async () => {
    const deps = fakeDeps({ resolveStaff: vi.fn(async () => { throw new Error("network down"); }) });
    const result = await runGate(deps, { verified: true }, "evans@noblestride.com", "u1");
    expect(deps.updateUser).not.toHaveBeenCalled();
    expect(result.action).toBe("block");
    if (result.action === "block") expect(result.response).toMatch(/can't verify your email right now/i);
  });

  it("verify_and_identify: resolveStaff success verifies, stores staffEmail/staffName, and welcomes in one message", async () => {
    const deps = fakeDeps({ resolveStaff: vi.fn(async () => ({ ok: true, firstName: "Jane" })) });
    const result = await runGate(deps, { verified: false }, `${PASS} jane@noblestride.capital`, "u1");
    expect(deps.updateUser).toHaveBeenCalledWith({ verified: true });
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
    expect(deps.updateUser).toHaveBeenCalledWith({ verified: true });
    expect(deps.updateUser).not.toHaveBeenCalledWith(expect.objectContaining({ staffEmail: expect.anything() }));
    expect(result.action).toBe("block");
    if (result.action === "block") expect(result.response).toMatch(/doesn't match an active CRM user/i);
  });

  it("verify_and_identify: CRM transport failure still verifies but blocks with IDENTIFY_ERROR", async () => {
    const deps = fakeDeps({ resolveStaff: vi.fn(async () => { throw new Error("network down"); }) });
    const result = await runGate(deps, { verified: false }, `${PASS} jane@noblestride.capital`, "u1");
    expect(deps.updateUser).toHaveBeenCalledWith({ verified: true });
    expect(result.action).toBe("block");
    if (result.action === "block") expect(result.response).toMatch(/can't verify your email right now/i);
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
  it("rejects email-only reply (no passphrase)", () => {
    expect(gateDecision(unverifiedState, "jane@noblestride.capital", PASS)).toBe("challenge");
  });
  it("rejects wrong passphrase even with a valid email", () => {
    expect(gateDecision(unverifiedState, "nope jane@noblestride.capital", PASS)).toBe("challenge");
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
