import { describe, it, expect, vi } from "vitest";
import IdentifyInvestorTool from "../IdentifyInvestorTool";
import type { CrmClient } from "../../../lib/crm-client";

function crmStub(result: unknown): CrmClient {
  return { baseUrl: "http://x", query: vi.fn(async () => ({ investorByEmail: result })) } as unknown as CrmClient;
}

describe("identify_investor", () => {
  it("returns the match payload from the CRM", async () => {
    const stub = crmStub({ matched: true, investorId: "inv1", investorName: "Acme Fund", contactName: "Jo" });
    const tool = new IdentifyInvestorTool({ crm: stub });
    const out = await tool.execute({ senderEmail: "jo@acme.fund" });
    expect(out).toEqual({ matched: true, investorId: "inv1", investorName: "Acme Fund", contactName: "Jo" });
    expect(stub.query).toHaveBeenCalledWith(expect.stringContaining("investorByEmail"), { email: "jo@acme.fund" });
  });
});
