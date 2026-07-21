import { describe, it, expect } from "vitest";
import { ListGreylistedInvestorsTool } from "../ListGreylistedInvestorsTool";
import type { CrmClient } from "../../../lib/crm-client";

function fakeCrm(investors: unknown[]): CrmClient {
  return {
    baseUrl: "https://crm.test",
    async query<T>(): Promise<T> {
      return { investors } as T;
    },
  };
}

// A CRM whose query throws — proves the staff gate refuses BEFORE any CRM access.
const explodingCrm: CrmClient = {
  baseUrl: "https://crm.test",
  async query<T>(): Promise<T> {
    throw new Error("CRM must not be reached for a non-staff caller");
  },
};

const ROWS = [
  { id: "i1", name: "Alpha Fund", engagementClassification: "Active", investorType: "PrivateEquity" },
  { id: "i2", name: "Bravo Capital", engagementClassification: "Greylisted", investorType: "VentureCapital" },
  { id: "i3", name: "Charlie DFI", engagementClassification: "Excluded", investorType: "DFI" },
];

describe("ListGreylistedInvestorsTool (referral, staff-gated)", () => {
  it("refuses a non-staff caller before touching the CRM", async () => {
    const tool = new ListGreylistedInvestorsTool({ crm: explodingCrm, isStaff: async () => false });
    const res = await tool.execute({ includeExcluded: false });
    expect(res.status).toBe("staff_only");
  });

  it("returns greylisted investors for a verified staff caller, with deep links and no raw ids", async () => {
    const tool = new ListGreylistedInvestorsTool({ crm: fakeCrm(ROWS), isStaff: async () => true });
    const res = await tool.execute({ includeExcluded: false });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.total).toBe(1);
    expect(res.investors[0].name).toBe("Bravo Capital");
    expect(res.investors[0].link).toMatch(/^https:\/\/crm\.test\/investors\//);
    expect(res.investors[0]).not.toHaveProperty("id"); // raw id never surfaced as a bare field
  });

  it("returns empty for staff when none are greylisted", async () => {
    const tool = new ListGreylistedInvestorsTool({
      crm: fakeCrm([{ id: "x", name: "Active One", engagementClassification: "Active" }]),
      isStaff: async () => true,
    });
    const res = await tool.execute({ includeExcluded: false });
    expect(res.status).toBe("empty");
  });

  it("includes Excluded for staff when requested", async () => {
    const tool = new ListGreylistedInvestorsTool({ crm: fakeCrm(ROWS), isStaff: async () => true });
    const res = await tool.execute({ includeExcluded: true });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.total).toBe(2);
  });
});
