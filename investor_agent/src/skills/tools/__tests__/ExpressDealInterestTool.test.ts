import { describe, it, expect, vi } from "vitest";
import ExpressDealInterestTool from "../ExpressDealInterestTool";
import type { CrmClient } from "../../../lib/crm-client";

describe("express_deal_interest", () => {
  it("returns the matched deal + portal link and forwards investorId + dealHint", async () => {
    const query = vi.fn(async () => ({
      expressDealInterestForAgent: {
        matched: true,
        dealName: "Project Indigo Kudu",
        portalUrl: "https://noble-stride.vercel.app/login?as=investor&next=%2Fportal%2Finvestor%2Fdeals%2Fabc",
      },
    }));
    const tool = new ExpressDealInterestTool({
      crm: { baseUrl: "http://x", query } as unknown as CrmClient,
      transportFrom: () => "investor@x.com",
    });
    const out = await tool.execute({ investorId: "inv1", dealHint: "Indigo Kudu" });
    expect(out).toEqual({
      matched: true,
      dealName: "Project Indigo Kudu",
      portalUrl: "https://noble-stride.vercel.app/login?as=investor&next=%2Fportal%2Finvestor%2Fdeals%2Fabc",
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("expressDealInterestForAgent"), {
      investorId: "inv1",
      dealHint: "Indigo Kudu",
    });
  });

  it("passes null dealHint when omitted and relays matched=false", async () => {
    const query = vi.fn(async () => ({
      expressDealInterestForAgent: { matched: false, dealName: null, portalUrl: null },
    }));
    const tool = new ExpressDealInterestTool({
      crm: { baseUrl: "http://x", query } as unknown as CrmClient,
      transportFrom: () => "investor@x.com",
    });
    const out = await tool.execute({ investorId: "inv1" });
    expect(out).toEqual({ matched: false, dealName: null, portalUrl: null });
    expect(query).toHaveBeenCalledWith(expect.anything(), { investorId: "inv1", dealHint: null });
  });

  it("refuses off-email (no transport-verified sender) and never calls the CRM", async () => {
    const query = vi.fn();
    const tool = new ExpressDealInterestTool({
      crm: { baseUrl: "http://x", query } as unknown as CrmClient,
      transportFrom: () => undefined,
    });
    const out = await tool.execute({ investorId: "inv1", dealHint: "Indigo Kudu" });
    expect(out).toMatchObject({ matched: false, refusal: "channel_unverified", portalUrl: null, dealName: null });
    expect(query).not.toHaveBeenCalled();
  });
});
