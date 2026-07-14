import { describe, it, expect, vi } from "vitest";
import { gateDecision, runGate, STAFF_COLLECTION, type GateDeps } from "../passphrase-gate";

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
        "✅ Passphrase accepted. To act on your behalf in the CRM I need your CRM email — what is it?",
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
});
