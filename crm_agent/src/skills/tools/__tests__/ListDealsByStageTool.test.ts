import { describe, it, expect } from "vitest";
import { ListDealsByStageTool } from "../ListDealsByStageTool";
import type { CrmClient } from "../../../lib/crm-client";

function fakeCrm(map: Record<string, unknown>): CrmClient {
  return {
    baseUrl: "https://crm.test",
    async query<T>(doc: string): Promise<T> {
      for (const [needle, value] of Object.entries(map)) {
        if (doc.includes(needle)) return value as T;
      }
      throw new Error(`no fake for query: ${doc.slice(0, 40)}`);
    },
  };
}

const SNAPSHOT = {
  AgentPipelineSnapshot: {
    mandatesByStage: [
      { stage: "Proposal", label: "Proposal", items: [
        { id: "m1", name: "Mandate A", dealSize: 2_000_000, currency: "USD", lead: { name: "Ravi" } },
      ] },
    ],
    transactionsByStage: [
      { stage: "ClosedWon", label: "Closed-Won", items: [
        { id: "t1", name: "Amos Fund", targetRaise: 6_000_000, currency: "USD", owner: { name: "Amos" } },
      ] },
      { stage: "Outreach", label: "Outreach", items: [
        { id: "t2", name: "Busoga Raise", targetRaise: 5_000_000, currency: "UGX", owner: { name: "Jane" } },
      ] },
    ],
  },
};

describe("ListDealsByStageTool", () => {
  it("rosters both pipelines with deal names + leads by stage", async () => {
    const tool = new ListDealsByStageTool({ crm: fakeCrm(SNAPSHOT) });
    const res = await tool.execute({ pipeline: "both" });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;

    expect(res.pipelines.map((p) => p.pipeline)).toEqual(["mandates", "transactions"]);
    const txns = res.pipelines.find((p) => p.pipeline === "transactions")!;
    const closedWon = txns.stages.find((s) => s.label === "Closed-Won")!;
    expect(closedWon.deals).toEqual([{ name: "Amos Fund", lead: "Amos", value: 6_000_000, currency: "USD" }]);
    const mandates = res.pipelines.find((p) => p.pipeline === "mandates")!;
    expect(mandates.stages[0].deals[0].lead).toBe("Ravi");
  });

  it("restricts to one pipeline when requested", async () => {
    const tool = new ListDealsByStageTool({ crm: fakeCrm(SNAPSHOT) });
    const res = await tool.execute({ pipeline: "transactions" });
    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(res.pipelines.map((p) => p.pipeline)).toEqual(["transactions"]);
  });

  it("filters to a single stage case-insensitively (by label or key)", async () => {
    const tool = new ListDealsByStageTool({ crm: fakeCrm(SNAPSHOT) });
    const res = await tool.execute({ pipeline: "transactions", stage: "closed-won" });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    const stages = res.pipelines[0].stages;
    expect(stages).toHaveLength(1);
    expect(stages[0].deals[0].name).toBe("Amos Fund");
  });

  it("returns empty when a stage filter matches nothing", async () => {
    const tool = new ListDealsByStageTool({ crm: fakeCrm(SNAPSHOT) });
    const res = await tool.execute({ pipeline: "both", stage: "NoSuchStage" });
    expect(res.status).toBe("empty");
  });

  it("caps the overview to a few names per stage and reports the remainder", async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      id: `x${i}`,
      name: `Deal ${i}`,
      targetRaise: 1_000_000,
      currency: "USD",
      owner: { name: "Amos" },
    }));
    const tool = new ListDealsByStageTool({
      crm: fakeCrm({
        AgentPipelineSnapshot: {
          mandatesByStage: [],
          transactionsByStage: [{ stage: "Outreach", label: "Outreach", items: many }],
        },
      }),
    });
    const res = await tool.execute({ pipeline: "transactions" });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    const stage = res.pipelines[0].stages[0];
    expect(stage.count).toBe(9); // true total preserved
    expect(stage.deals).toHaveLength(5); // only the first few names shown
    expect(stage.remaining).toBe(4); // the rest reported as a count
  });

  it("returns a named stage in full (remaining 0) so drill-down shows every name", async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      id: `x${i}`,
      name: `Deal ${i}`,
      targetRaise: 1_000_000,
      currency: "USD",
      owner: { name: "Amos" },
    }));
    const tool = new ListDealsByStageTool({
      crm: fakeCrm({
        AgentPipelineSnapshot: {
          mandatesByStage: [],
          transactionsByStage: [{ stage: "Outreach", label: "Outreach", items: many }],
        },
      }),
    });
    const res = await tool.execute({ pipeline: "transactions", stage: "Outreach" });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    const stage = res.pipelines[0].stages[0];
    expect(stage.deals).toHaveLength(9);
    expect(stage.remaining).toBe(0);
  });

  it("adds remaining 0 to a small stage in the default overview", async () => {
    const tool = new ListDealsByStageTool({ crm: fakeCrm(SNAPSHOT) });
    const res = await tool.execute({ pipeline: "transactions" });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    const closedWon = res.pipelines[0].stages.find((s) => s.label === "Closed-Won")!;
    expect(closedWon.remaining).toBe(0);
    expect(closedWon.deals).toHaveLength(1);
  });

  it("returns empty when the pipeline has no deals at all", async () => {
    const tool = new ListDealsByStageTool({
      crm: fakeCrm({ AgentPipelineSnapshot: { mandatesByStage: [], transactionsByStage: [] } }),
    });
    const res = await tool.execute({ pipeline: "both" });
    expect(res.status).toBe("empty");
  });
});
