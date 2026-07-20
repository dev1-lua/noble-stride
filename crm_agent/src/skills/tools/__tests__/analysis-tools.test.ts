import { describe, it, expect } from "vitest";
import { DealHealthTool } from "../DealHealthTool";
import { AnalyzePipelineTool } from "../AnalyzePipelineTool";
import { MatchInvestorsTool } from "../MatchInvestorsTool";
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
const generate = async (_p: string) => "GENERATED SUMMARY";

describe("DealHealthTool", () => {
  it("resolves, assesses, and returns summary + depth + link", async () => {
    const crm = fakeCrm({
      globalSearch: { globalSearch: [{ id: "t1", type: "Transaction", title: "Busoga Raise", href: "/transactions/t1" }] },
      "query AgentTransaction": { transaction: { name: "Busoga Raise", stage: "Outreach", stageEnteredAt: "2020-01-01", updatedAt: "2020-01-01", engagements: [{ name: "e" }], activities: [] } },
      AgentDocuments: { documents: [] },
    });
    const tool = new DealHealthTool({ crm, generate });
    const res = await tool.execute({ recordType: "transaction", query: "Busoga" });
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.summary).toBe("GENERATED SUMMARY");
      expect(res.link).toBe("https://crm.test/transactions/t1");
      expect(res.depth.map((d) => d.dimension)).toContain("engagements");
    }
  });

  it("returns not_found when the record does not resolve", async () => {
    const crm = fakeCrm({ globalSearch: { globalSearch: [] } });
    const tool = new DealHealthTool({ crm, generate });
    const res = await tool.execute({ recordType: "transaction", query: "Nope" });
    expect(res.status).toBe("not_found");
  });
});

describe("AnalyzePipelineTool", () => {
  it("returns an analytical summary with depth", async () => {
    const crm = fakeCrm({
      AgentPipelineSnapshot: { mandatesByStage: [], transactionsByStage: [
        { stage: "Outreach", label: "Outreach", items: [{ id: "1", name: "A", stageEnteredAt: "2020-01-01", createdAt: "2020-01-01", updatedAt: "2020-01-01", targetRaise: 1000, sector: ["Fintech"] }] },
      ] },
    });
    const tool = new AnalyzePipelineTool({ crm, generate });
    const res = await tool.execute({ pipeline: "transactions" });
    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(res.summary).toBe("GENERATED SUMMARY");
  });
});

describe("MatchInvestorsTool", () => {
  it("returns candidates from the CRM matcher", async () => {
    const crm = fakeCrm({
      globalSearch: { globalSearch: [{ id: "tx1", type: "Transaction", title: "Acme Raise", href: "/transactions/tx1" }] },
      AgentMatchInvestors: { matchInvestorsForTransaction: [{ investorId: "i1", name: "FundX", contactName: "Jo", matchReasons: ["sector"], hasExistingEngagement: false }] },
    });
    const tool = new MatchInvestorsTool({ crm, generate });
    const res = await tool.execute({ transactionQuery: "Acme" });
    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(res.summary).toContain("FundX");
  });
});
