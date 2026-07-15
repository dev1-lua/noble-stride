import { describe, it, expect, vi } from "vitest";
import { ScanStalledEngagementsTool } from "../ScanStalledEngagementsTool";
import { DEFAULT_STALE_DAYS } from "../../../lib/staleness";
import type { CrmClient } from "../../../lib/crm-client";

const NOW = new Date("2026-07-14T08:00:00Z");
const DEAL_HIT = { id: "t1", type: "Transaction", title: "Busoga Raise", subtitle: null, href: "/transactions/t1" };

const SCAN_PAYLOAD = {
  engagementsByDeal: [
    {
      transaction: { id: "t1", name: "Busoga Raise", stage: "InvestorOutreach", dealStatus: "Open", client: null },
      engagements: [
        {
          id: "e1",
          name: "Vantage × Busoga",
          engagementStage: "TeaserSent",
          lastContact: null,
          updatedAt: "2026-07-01T08:00:00Z",
          termSheetIssued: false,
          termSheetDate: null,
          totalAmount: null,
          amountDisbursed: null,
          amountPending: null,
          disbursementStatus: null,
          investor: { id: "i1", name: "Vantage Capital", engagementClassification: "Active" },
        },
      ],
    },
  ],
};

function crmStub(searchHits: unknown[] = [DEAL_HIT]): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string) => {
      if (document.includes("globalSearch")) return { globalSearch: searchHits };
      return SCAN_PAYLOAD;
    }) as CrmClient["query"],
  };
}

describe("ScanStalledEngagementsTool", () => {
  const deps = { thresholds: DEFAULT_STALE_DAYS, now: () => NOW };

  it("returns flags for the whole book with no filters", async () => {
    const out = await new ScanStalledEngagementsTool({ crm: crmStub(), ...deps }).execute({});
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;
    expect(out.flagged).toBe(1);
    expect(out.flags[0]).toMatchObject({ investor: "Vantage Capital", deal: "Busoga Raise", reason: "stalled", idleDays: 13 });
  });

  it("scopes to a resolved deal", async () => {
    const out = await new ScanStalledEngagementsTool({ crm: crmStub(), ...deps }).execute({ deal: "busoga" });
    expect(out.status).toBe("ok");
    if (out.status === "ok") expect(out.flagged).toBe(1);
  });

  it("returns ambiguous candidates when the filter name is unclear", async () => {
    const two = [DEAL_HIT, { ...DEAL_HIT, id: "t2", title: "Busoga Raise II" }];
    const out = await new ScanStalledEngagementsTool({ crm: crmStub(two), ...deps }).execute({ deal: "busoga" });
    expect(out.status).toBe("ambiguous");
  });

  it("returns not_found for an unknown filter name", async () => {
    const out = await new ScanStalledEngagementsTool({ crm: crmStub([]), ...deps }).execute({ deal: "nothing" });
    expect(out.status).toBe("not_found");
  });
});
