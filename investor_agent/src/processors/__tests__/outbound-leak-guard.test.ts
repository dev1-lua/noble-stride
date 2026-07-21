import { describe, it, expect, vi } from "vitest";
import { enforceOutbound, withSignOff, SAFE_ACK, SIGN_OFF } from "../outbound-leak-guard";
import { scanOutbound } from "../../lib/guardrails/outbound-scan";

describe("enforceOutbound", () => {
  it("passes a clean reply through unchanged", async () => {
    const clean = "Thank you — the deal team has your note and will follow up.";
    expect(await enforceOutbound(clean, "jo@fund.com", { recordFlag: vi.fn() })).toBe(clean);
  });
  it("replaces a leaked reply with SAFE_ACK (fail-closed)", async () => {
    const leaked = "Yes, they are one of our clients.";
    const recordFlag = vi.fn(async () => true);
    expect(await enforceOutbound(leaked, "evil@x.com", { recordFlag })).toBe(SAFE_ACK);
    expect(recordFlag).toHaveBeenCalledOnce();
  });
  it("still replaces a leaked reply even if flagging throws (enforcement independent of I/O)", async () => {
    const leaked = "id 550e8400-e29b-41d4-a716-446655440000";
    const recordFlag = vi.fn(async () => { throw new Error("data down"); });
    await expect(enforceOutbound(leaked, undefined, { recordFlag })).resolves.toBe(SAFE_ACK);
  });
  it("SAFE_ACK does not itself trip the scanner", () => {
    expect(scanOutbound(SAFE_ACK).leaked).toBe(false);
  });
  it("SAFE_ACK does not claim the message was filed or forwarded (no log tool ran)", () => {
    // 2026-07-21 QA: the old wording ("I've made sure the team has it") asserted an action
    // that never happened.
    expect(SAFE_ACK.toLowerCase()).not.toContain("made sure");
    expect(SAFE_ACK.toLowerCase()).not.toContain("has your message");
    expect(SAFE_ACK.toLowerCase()).not.toContain("has it");
  });
});

describe("withSignOff", () => {
  // 2026-07-21 QA: the persona sign-off rule was honored in 0/14 organic replies — the
  // postprocessor now guarantees it deterministically.
  it("appends the sign-off to a reply that lacks it", () => {
    expect(withSignOff("Thanks — the team will follow up.")).toBe(
      `Thanks — the team will follow up.\n\n${SIGN_OFF}`,
    );
  });
  it("does not double an already-signed reply (any case)", () => {
    const signed = `Thanks!\n\nnoblestride investor relations`;
    expect(withSignOff(signed)).toBe(signed);
  });
  it("does not double SAFE_ACK", () => {
    expect(withSignOff(SAFE_ACK)).toBe(SAFE_ACK);
  });
  it("signed output stays clean for the scanner", () => {
    expect(scanOutbound(withSignOff("Thanks — the team will follow up.")).leaked).toBe(false);
  });
});
