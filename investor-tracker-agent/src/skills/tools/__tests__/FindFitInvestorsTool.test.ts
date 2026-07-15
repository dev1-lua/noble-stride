import { describe, it, expect, vi } from "vitest";
import { FindFitInvestorsTool } from "../FindFitInvestorsTool";
import type { CrmClient } from "../../../lib/crm-client";

const DEAL_HIT = { id: "t1", type: "Transaction", title: "Busoga Raise", subtitle: null, href: "/transactions/t1" };

function crmStub(opts: {
  matches: unknown[];
  engagements?: Array<{ investor: { id: string; engagementClassification?: string | null } }>;
}): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string) => {
      if (document.includes("globalSearch")) return { globalSearch: [DEAL_HIT] };
      if (document.includes("aiMatchInvestors")) return { aiMatchInvestors: opts.matches };
      return { transaction: { id: "t1", name: "Busoga Raise", engagements: opts.engagements ?? [] } };
    }) as CrmClient["query"],
  };
}

const match = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: `Fund ${id}`,
  score: 80,
  reasons: ["sector match"],
  warnings: [],
  contactName: null,
  criteriaStale: false,
  ...over,
});

describe("FindFitInvestorsTool", () => {
  it("returns ranked matches and marks investors already engaged on the deal", async () => {
    const crm = crmStub({
      matches: [match("i1"), match("i2")],
      engagements: [{ investor: { id: "i2", engagementClassification: "Active" } }],
    });
    const out = await new FindFitInvestorsTool({ crm }).execute({ deal: "busoga" });
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;
    expect(out.matches.map((m) => [m.id, m.alreadyEngagedOnThisDeal])).toEqual([
      ["i1", false],
      ["i2", true],
    ]);
  });

  it("drops matches whose engaged classification is Excluded/Greylisted (defense in depth)", async () => {
    const crm = crmStub({
      matches: [match("i1"), match("bad")],
      engagements: [{ investor: { id: "bad", engagementClassification: "Excluded" } }],
    });
    const out = await new FindFitInvestorsTool({ crm }).execute({ deal: "busoga" });
    if (out.status !== "ok") throw new Error("expected ok");
    expect(out.matches.map((m) => m.id)).toEqual(["i1"]);
  });

  it("reports not_found for an unknown deal", async () => {
    const crm: CrmClient = {
      baseUrl: "https://crm.example",
      query: vi.fn(async () => ({ globalSearch: [] })) as CrmClient["query"],
    };
    const out = await new FindFitInvestorsTool({ crm }).execute({ deal: "nothing" });
    expect(out.status).toBe("not_found");
  });
});
