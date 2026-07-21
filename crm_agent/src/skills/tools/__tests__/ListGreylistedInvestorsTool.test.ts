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

const ROWS = [
  { id: "i1", name: "Alpha Fund", engagementClassification: "Active", investorType: "PrivateEquity" },
  { id: "i2", name: "Bravo Capital", engagementClassification: "Greylisted", investorType: "VentureCapital" },
  { id: "i3", name: "Charlie DFI", engagementClassification: "Excluded", investorType: "DFI" },
  { id: "i4", name: "Delta Family", engagementClassification: "Greylisted", investorType: null },
];

describe("ListGreylistedInvestorsTool", () => {
  it("returns only greylisted investors by default, with deep links and no raw ids", async () => {
    const res = await new ListGreylistedInvestorsTool({ crm: fakeCrm(ROWS) }).execute({ includeExcluded: false });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.total).toBe(2);
    expect(res.investors.map((i) => i.name).sort()).toEqual(["Bravo Capital", "Delta Family"]);
    expect(res.investors.every((i) => i.classification === "Greylisted")).toBe(true);
    expect(res.investors[0].link).toMatch(/^https:\/\/crm\.test\/investors\//);
    expect(res.investors[0]).not.toHaveProperty("id"); // raw id never surfaced as a bare field
  });

  it("includes Excluded when includeExcluded is true", async () => {
    const res = await new ListGreylistedInvestorsTool({ crm: fakeCrm(ROWS) }).execute({ includeExcluded: true });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.total).toBe(3);
    expect(res.investors.map((i) => i.classification).sort()).toEqual(["Excluded", "Greylisted", "Greylisted"]);
  });

  it("returns empty when none are greylisted", async () => {
    const res = await new ListGreylistedInvestorsTool({
      crm: fakeCrm([{ id: "x", name: "Active One", engagementClassification: "Active" }]),
    }).execute({ includeExcluded: false });
    expect(res.status).toBe("empty");
  });
});
