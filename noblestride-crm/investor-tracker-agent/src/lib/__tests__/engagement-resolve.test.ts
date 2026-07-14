import { describe, it, expect, vi } from "vitest";
import { resolveEngagement } from "../engagement-resolve";
import type { CrmClient } from "../crm-client";

const INVESTOR_HIT = { id: "i1", type: "Investor", title: "Vantage Capital", subtitle: null, href: "/investors/i1" };
const DEAL_HIT = { id: "t1", type: "Transaction", title: "Busoga Raise", subtitle: null, href: "/transactions/t1" };

function crmStub(opts: {
  investorHits?: unknown[];
  dealHits?: unknown[];
  engagements?: Array<{ id: string; investor: { id: string; name: string } }>;
  transaction?: unknown;
}): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string, variables?: Record<string, unknown>) => {
      if (document.includes("globalSearch")) {
        // First arg differentiates by the query text we passed in.
        const q = String(variables?.query ?? "");
        if (q.toLowerCase().includes("vantage") || q === "i1") return { globalSearch: opts.investorHits ?? [INVESTOR_HIT] };
        return { globalSearch: opts.dealHits ?? [DEAL_HIT] };
      }
      return {
        transaction:
          opts.transaction !== undefined
            ? opts.transaction
            : { id: "t1", name: "Busoga Raise", engagements: opts.engagements ?? [] },
      };
    }) as CrmClient["query"],
  };
}

describe("resolveEngagement", () => {
  it("finds the engagement joining a resolved investor and deal", async () => {
    const crm = crmStub({ engagements: [{ id: "e9", investor: { id: "i1", name: "Vantage Capital" } }] });
    const out = await resolveEngagement(crm, "vantage", "busoga");
    expect(out).toEqual({
      kind: "ok",
      engagementId: "e9",
      investor: { id: "i1", name: "Vantage Capital" },
      transaction: { id: "t1", name: "Busoga Raise" },
    });
  });

  it("reports no_engagement when the investor is not on the deal", async () => {
    const crm = crmStub({ engagements: [{ id: "e2", investor: { id: "other", name: "Someone Else" } }] });
    const out = await resolveEngagement(crm, "vantage", "busoga");
    expect(out.kind).toBe("no_engagement");
  });

  it("reports investor_not_found / deal_not_found", async () => {
    expect((await resolveEngagement(crmStub({ investorHits: [] }), "vantage", "busoga")).kind).toBe("investor_not_found");
    expect((await resolveEngagement(crmStub({ dealHits: [] }), "vantage", "busoga")).kind).toBe("deal_not_found");
  });

  it("reports ambiguity with a candidates shortlist", async () => {
    const two = [INVESTOR_HIT, { ...INVESTOR_HIT, id: "i2", title: "Vantage Mezzanine" }];
    const out = await resolveEngagement(crmStub({ investorHits: two }), "vantage", "busoga");
    expect(out.kind).toBe("ambiguous_investor");
    if (out.kind === "ambiguous_investor") expect(out.candidates).toHaveLength(2);
  });

  it("accepts an exact id in place of a name", async () => {
    const crm = crmStub({ engagements: [{ id: "e9", investor: { id: "i1", name: "Vantage Capital" } }] });
    const out = await resolveEngagement(crm, "i1", "busoga");
    expect(out.kind).toBe("ok");
  });

  it("reports deal_not_found when the transaction detail comes back null", async () => {
    const out = await resolveEngagement(crmStub({ transaction: null }), "vantage", "busoga");
    expect(out.kind).toBe("deal_not_found");
  });
});
