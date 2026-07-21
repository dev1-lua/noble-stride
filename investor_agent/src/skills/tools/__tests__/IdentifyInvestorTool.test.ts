import { describe, it, expect, vi } from "vitest";
import IdentifyInvestorTool from "../IdentifyInvestorTool";
import type { CrmClient } from "../../../lib/crm-client";

function crmStub(result: unknown): CrmClient {
  return { baseUrl: "http://x", query: vi.fn(async () => ({ investorByEmail: result })) } as unknown as CrmClient;
}

describe("identify_investor", () => {
  it("keys the lookup on the transport-verified sender only (no model input exists)", async () => {
    const stub = crmStub({ matched: true, investorId: "inv1", investorName: "Acme Fund", contactName: "Jo" });
    const out = await new IdentifyInvestorTool({ crm: stub, transportFrom: () => "jo@acme.fund" }).execute({});
    expect(out).toEqual({ matched: true, investorId: "inv1", investorName: "Acme Fund", contactName: "Jo" });
    expect(stub.query).toHaveBeenCalledWith(expect.stringContaining("investorByEmail"), { email: "jo@acme.fund" });
  });

  it("refuses (channel_unverified) off-email and never queries the CRM", async () => {
    // 2026-07-21 prod QA CRITICAL: identify used to trust a model-supplied senderEmail on
    // every channel, letting any webchat visitor resolve an arbitrary investor's identity.
    const stub = crmStub({ matched: true, investorId: "inv1" });
    const out = await new IdentifyInvestorTool({ crm: stub, transportFrom: () => undefined }).execute({});
    expect(out.matched).toBe(false);
    expect((out as { refusal?: string }).refusal).toBe("channel_unverified");
    expect(stub.query).not.toHaveBeenCalled();
  });

  it("exposes no email input for the model to steer", () => {
    const tool = new IdentifyInvestorTool({ crm: crmStub({}), transportFrom: () => "jo@acme.fund" });
    expect(Object.keys(tool.inputSchema.shape)).toEqual([]);
  });
});
