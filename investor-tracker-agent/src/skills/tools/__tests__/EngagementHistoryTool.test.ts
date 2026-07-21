import { describe, it, expect, vi } from "vitest";
import { EngagementHistoryTool } from "../EngagementHistoryTool";
import type { CrmClient } from "../../../lib/crm-client";

const ENGAGEMENT = {
  id: "e1",
  name: "Vantage × Busoga",
  engagementStage: "TermSheet",
  transaction: { id: "t1", name: "Busoga Raise" },
  investor: { id: "i1", name: "Vantage Capital" },
  stageChanges: [
    {
      field: "engagementStage",
      fromValue: "TeaserSent",
      toValue: "NDA",
      changedAt: "2026-06-05T00:00:00Z",
      createdSource: "USER",
      changedBy: { id: "u1", name: "Solomon" },
    },
    {
      field: "interestLevel",
      fromValue: "Medium",
      toValue: "High",
      changedAt: "2026-06-04T00:00:00Z",
      createdSource: "AGENT",
      changedBy: null,
    },
    {
      field: "engagementStage",
      fromValue: null,
      toValue: "TeaserSent",
      changedAt: "2026-06-01T00:00:00Z",
      createdSource: "USER",
      changedBy: { id: "u1", name: "Solomon" },
    },
  ],
};

function crmStub(engagement: unknown): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string) => {
      if (document.includes("TrackerEngagementHistory")) return { engagement };
      throw new Error(`unexpected document: ${document.slice(0, 60)}`);
    }) as CrmClient["query"],
  };
}

describe("EngagementHistoryTool", () => {
  it("returns stage moves only by default", async () => {
    const out = await new EngagementHistoryTool({ crm: crmStub(ENGAGEMENT) }).execute({ engagementId: "e1" });
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;
    expect(out.historyCount).toBe(2);
    expect(out.history.every((h) => h.field === "engagementStage")).toBe(true);
    expect(out.history[0]).toMatchObject({ from: "TeaserSent", to: "NDA", source: "USER", changedBy: "Solomon" });
    expect(out.engagement.currentStage).toBe("TermSheet");
    expect(out.link).toBe("https://crm.example/engagement/e1");
  });

  it("includes every tracked field when allFields is true", async () => {
    const out = await new EngagementHistoryTool({ crm: crmStub(ENGAGEMENT) }).execute({
      engagementId: "e1",
      allFields: true,
    });
    if (out.status !== "ok") throw new Error("expected ok");
    expect(out.historyCount).toBe(3);
    expect(out.history.some((h) => h.field === "interestLevel")).toBe(true);
  });

  it("rejects when neither engagementId nor both names are given", async () => {
    const out = await new EngagementHistoryTool({ crm: crmStub(ENGAGEMENT) }).execute({ deal: "busoga" });
    expect(out.status).toBe("rejected");
  });

  it("returns not_found when the engagement cannot be loaded", async () => {
    const out = await new EngagementHistoryTool({ crm: crmStub(null) }).execute({ engagementId: "gone" });
    expect(out.status).toBe("not_found");
  });
});
