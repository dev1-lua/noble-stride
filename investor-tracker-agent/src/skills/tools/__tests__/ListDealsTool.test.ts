import { describe, it, expect, vi } from "vitest";
import { ListDealsTool } from "../ListDealsTool";
import type { CrmClient } from "../../../lib/crm-client";

const SNAPSHOT = {
  transactionsByStage: [
    {
      stage: "DueDiligence",
      label: "Due Diligence",
      items: [
        {
          id: "t1",
          name: "Busoga Raise",
          stageEnteredAt: "2026-06-01T00:00:00Z",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-06-01T00:00:00Z",
          dateOpened: "2026-01-01",
          currency: "USD",
          targetRaise: 5_000_000,
        },
      ],
    },
    {
      stage: "ClosedWon",
      label: "Closed Won",
      items: [
        {
          id: "t2",
          name: "Camino Ruiz",
          stageEnteredAt: "2026-03-01T00:00:00Z",
          createdAt: "2025-10-01T00:00:00Z",
          updatedAt: "2026-03-01T00:00:00Z",
          dateOpened: "2025-10-01",
          currency: "USD",
          targetRaise: 2_000_000,
        },
        {
          id: "t3",
          name: "CESP Africa",
          stageEnteredAt: "2026-04-01T00:00:00Z",
          createdAt: "2025-11-01T00:00:00Z",
          updatedAt: "2026-04-01T00:00:00Z",
          dateOpened: null,
          currency: null,
          targetRaise: null,
        },
      ],
    },
    { stage: "ClosedLost", label: "Closed Lost", items: [] },
  ],
  mandatesByStage: [
    {
      stage: "Signed",
      label: "Signed",
      items: [
        {
          id: "m1",
          name: "Acacia Advisory",
          stageEnteredAt: "2026-05-01T00:00:00Z",
          createdAt: "2026-02-01T00:00:00Z",
          updatedAt: "2026-05-01T00:00:00Z",
          dateOpened: "2026-02-01",
          currency: "USD",
          dealSize: 1_000_000,
        },
      ],
    },
  ],
  advisoryByStage: [
    {
      stage: "Delivery",
      label: "Delivery",
      items: [
        {
          id: "a1",
          name: "Zanzu Strategic Review",
          stageEnteredAt: "2026-06-15T00:00:00Z",
          createdAt: "2026-03-01T00:00:00Z",
          updatedAt: "2026-06-15T00:00:00Z",
          dateOpened: "2026-03-01",
          currency: "USD",
          feeAmount: 150_000,
        },
      ],
    },
    { stage: "Lost", label: "Lost", items: [] },
  ],
};

function stub(): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string) => {
      if (document.includes("AgentPipelineSnapshot")) return SNAPSHOT;
      throw new Error(`unexpected document: ${document.slice(0, 60)}`);
    }) as CrmClient["query"],
  };
}

describe("ListDealsTool", () => {
  it("lists every transaction grouped by stage, including closed stages", async () => {
    const out = await new ListDealsTool({ crm: stub() }).execute({ pipeline: "transactions" });
    expect(out.status).toBe("ok");
    expect(out.pipelines).toHaveLength(1);
    const [txns] = out.pipelines;
    expect(txns.pipeline).toBe("transactions");
    expect(txns.totalCount).toBe(3);
    expect(txns.stages.map((s) => ({ label: s.label, count: s.count }))).toEqual([
      { label: "Due Diligence", count: 1 },
      { label: "Closed Won", count: 2 },
      { label: "Closed Lost", count: 0 },
    ]);
    const closedWon = txns.stages[1];
    expect(closedWon.deals.map((d) => d.name)).toEqual(["Camino Ruiz", "CESP Africa"]);
    expect(closedWon.deals[0]).toMatchObject({
      dateOpened: "2025-10-01",
      currency: "USD",
      amount: 2_000_000,
      link: "https://crm.example/transactions/t2",
    });
    expect(closedWon.deals[1]).toMatchObject({ dateOpened: null, currency: null, amount: null });
  });

  it("lists mandates with dealSize as the amount and mandate links", async () => {
    const out = await new ListDealsTool({ crm: stub() }).execute({ pipeline: "mandates" });
    expect(out.pipelines).toHaveLength(1);
    const [mandates] = out.pipelines;
    expect(mandates.pipeline).toBe("mandates");
    expect(mandates.totalCount).toBe(1);
    expect(mandates.stages[0].deals[0]).toMatchObject({
      name: "Acacia Advisory",
      amount: 1_000_000,
      link: "https://crm.example/mandates/m1",
    });
  });

  it("lists advisory with feeAmount as the amount and advisory links", async () => {
    const out = await new ListDealsTool({ crm: stub() }).execute({ pipeline: "advisory" });
    expect(out.pipelines).toHaveLength(1);
    const [advisory] = out.pipelines;
    expect(advisory.pipeline).toBe("advisory");
    expect(advisory.totalCount).toBe(1);
    expect(advisory.stages[0].deals[0]).toMatchObject({
      name: "Zanzu Strategic Review",
      amount: 150_000,
      link: "https://crm.example/advisory/a1",
    });
  });

  it("returns all three pipelines, transactions first", async () => {
    const out = await new ListDealsTool({ crm: stub() }).execute({ pipeline: "all" });
    expect(out.pipelines.map((p) => p.pipeline)).toEqual(["transactions", "mandates", "advisory"]);
  });

  it("no longer accepts the removed 'both' value", () => {
    const parsed = new ListDealsTool().inputSchema.safeParse({ pipeline: "both" });
    expect(parsed.success).toBe(false);
  });
});
