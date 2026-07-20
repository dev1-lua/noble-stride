import { describe, it, expect, vi } from "vitest";
import { CheckCompanyTool } from "../CheckCompanyTool";
import type { CrmClient } from "../../../lib/crm-client";

function crmStub(status: string): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async () => ({ checkCompany: { status } })) as CrmClient["query"],
  };
}

describe("CheckCompanyTool", () => {
  it("returns only the status enum", async () => {
    const tool = new CheckCompanyTool({ crm: crmStub("known_verified") });
    const out = await tool.execute({ companyName: "Chai Estates", contactEmail: "jane@chai.example" });
    expect(out).toEqual({ status: "known_verified" });
  });
  it("passes null for a missing email", async () => {
    const crm = crmStub("new");
    const tool = new CheckCompanyTool({ crm });
    await tool.execute({ companyName: "Ghost Co" });
    expect(crm.query).toHaveBeenCalledWith(expect.stringContaining("checkCompany"), {
      name: "Ghost Co",
      contactEmail: null,
    });
  });
});
