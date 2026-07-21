import { describe, it, expect, vi } from "vitest";
import { enforceOutbound, SAFE_ACK } from "../outbound-leak-guard";
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
});
