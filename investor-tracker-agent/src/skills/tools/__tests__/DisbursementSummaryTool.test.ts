import { describe, it, expect, vi } from "vitest";
import { DisbursementSummaryTool } from "../DisbursementSummaryTool";
import type { CrmClient } from "../../../lib/crm-client";

const SINGLE = {
  id: "e1",
  name: "Vantage × Busoga",
  totalAmount: 2_000_000,
  amountDisbursed: 500_000,
  amountPending: 1_500_000,
  disbursementStatus: "Ongoing",
  dateReceived: "2026-06-01T00:00:00Z",
  transaction: { id: "t1", name: "Busoga Raise" },
  investor: { id: "i1", name: "Vantage Capital" },
};

const DEAL_ROW = {
  transaction: { id: "t1", name: "Busoga Raise", stage: "DueDiligence", dealStatus: "Open" },
  engagements: [
    {
      id: "e1",
      investor: { id: "i1", name: "Vantage Capital" },
      totalAmount: 2_000_000,
      amountDisbursed: 500_000,
      amountPending: 1_500_000,
      disbursementStatus: "Ongoing",
    },
    {
      id: "e2",
      investor: { id: "i2", name: "Kuramo" },
      totalAmount: 1_000_000,
      amountDisbursed: 1_000_000,
      amountPending: 0,
      disbursementStatus: "Disbursed",
    },
    {
      id: "e3",
      investor: { id: "i3", name: "TLcom" },
      totalAmount: null,
      amountDisbursed: null,
      amountPending: null,
      disbursementStatus: null,
    },
  ],
};

const SECOND_DEAL_ROW = {
  transaction: { id: "t2", name: "Kampala Logistics", stage: "ClosedWon", dealStatus: "Closed" },
  engagements: [
    {
      id: "e4",
      investor: { id: "i4", name: "Helios" },
      totalAmount: 4_000_000,
      amountDisbursed: 4_000_000,
      amountPending: 0,
      disbursementStatus: "Disbursed",
    },
  ],
};

function singleStub(): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string) => {
      if (document.includes("TrackerEngagement(")) return { engagement: SINGLE };
      throw new Error(`unexpected document: ${document.slice(0, 60)}`);
    }) as CrmClient["query"],
  };
}

function dealStub(): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string) => {
      if (document.includes("globalSearch")) {
        return { globalSearch: [{ id: "t1", type: "Transaction", title: "Busoga Raise", subtitle: null, href: "/x" }] };
      }
      if (document.includes("TrackerEngagementsByDeal")) return { engagementsByDeal: [DEAL_ROW] };
      throw new Error(`unexpected document: ${document.slice(0, 60)}`);
    }) as CrmClient["query"],
  };
}

describe("DisbursementSummaryTool", () => {
  it("single-engagement mode returns that engagement's amounts", async () => {
    const out = await new DisbursementSummaryTool({ crm: singleStub() }).execute({ engagementId: "e1" });
    expect(out.status).toBe("ok");
    if (out.status !== "ok" || out.mode !== "engagement") throw new Error("expected engagement mode");
    expect(out.amounts).toMatchObject({ total: 2_000_000, disbursed: 500_000, pending: 1_500_000, disbursementStatus: "Ongoing" });
    expect(out.link).toBe("https://crm.example/engagement/e1");
  });

  it("deal roll-up mode sums across investors and breaks down by status", async () => {
    const out = await new DisbursementSummaryTool({ crm: dealStub() }).execute({ deal: "Busoga Raise" });
    if (out.status !== "ok" || out.mode !== "deal") throw new Error("expected deal mode");
    expect(out.totals).toMatchObject({ total: 3_000_000, disbursed: 1_500_000, pending: 1_500_000, engagementCount: 3 });
    expect(out.byStatus).toMatchObject({ Ongoing: 1, Disbursed: 1, Unspecified: 1 });
    expect(out.engagements).toHaveLength(3);
    expect(out.link).toBe("https://crm.example/transactions/t1");
  });

  it("all-deals mode rolls up every deal with grand totals when no args are given", async () => {
    const crm: CrmClient = {
      baseUrl: "https://crm.example",
      query: vi.fn(async (document: string) => {
        if (document.includes("TrackerEngagementsByDeal")) {
          return { engagementsByDeal: [DEAL_ROW, SECOND_DEAL_ROW] };
        }
        if (document.includes("AgentPipelineSnapshot")) {
          return {
            transactionsByStage: [
              {
                stage: "DealPreparation",
                label: "Deal Preparation",
                items: [
                  { id: "t3", name: "Fresh Deal – Seed" },
                  { id: "t1", name: "Busoga Raise" },
                ],
              },
              { stage: "ClosedWon", label: "Closed-Won", items: [{ id: "t2", name: "Kampala Logistics" }] },
            ],
          };
        }
        throw new Error(`unexpected document: ${document.slice(0, 60)}`);
      }) as CrmClient["query"],
    };
    const out = await new DisbursementSummaryTool({ crm }).execute({});
    if (out.status !== "ok" || out.mode !== "all_deals") throw new Error("expected all_deals mode");
    expect(out.grandTotals).toMatchObject({
      total: 7_000_000,
      disbursed: 5_500_000,
      pending: 1_500_000,
      engagementCount: 4,
      dealCount: 2,
      dealsWithoutEngagementsCount: 1,
    });
    expect(out.dealsWithoutEngagements).toEqual([
      { name: "Fresh Deal – Seed", stage: "Deal Preparation", link: "https://crm.example/transactions/t3" },
    ]);
    expect(out.note).toContain("1 deal(s) have no investor engagements");
    // Sorted by disbursed desc: Kampala (4M) before Busoga (1.5M).
    expect(out.deals.map((d) => d.deal.name)).toEqual(["Kampala Logistics", "Busoga Raise"]);
    expect(out.deals[1]).toMatchObject({
      deal: { name: "Busoga Raise", stage: "DueDiligence", dealStatus: "Open" },
      totals: { total: 3_000_000, disbursed: 1_500_000, pending: 1_500_000, engagementCount: 3 },
      byStatus: { Ongoing: 1, Disbursed: 1, Unspecified: 1 },
      link: "https://crm.example/transactions/t1",
    });
  });

  it("rejects an investor without a deal", async () => {
    const out = await new DisbursementSummaryTool({ crm: singleStub() }).execute({ investor: "Vantage Capital" });
    expect(out.status).toBe("rejected");
  });
});
