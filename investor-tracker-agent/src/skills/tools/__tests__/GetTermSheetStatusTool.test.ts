import { describe, it, expect, vi } from "vitest";
import { GetTermSheetStatusTool } from "../GetTermSheetStatusTool";
import type { CrmClient } from "../../../lib/crm-client";

function baseEngagement(overrides: Record<string, unknown> = {}) {
  return {
    id: "e1",
    name: "Vantage × Busoga",
    engagementStage: "TermSheet",
    termSheetIssued: false,
    termSheetDate: null,
    transaction: { id: "t1", name: "Busoga Raise" },
    investor: { id: "i1", name: "Vantage Capital" },
    milestones: [] as Array<{ key: string; completedAt: string; notes: string | null }>,
    ...overrides,
  };
}

function crmStub(engagement: unknown): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string) => {
      if (document.includes("TrackerEngagement(")) return { engagement };
      throw new Error(`unexpected document: ${document.slice(0, 60)}`);
    }) as CrmClient["query"],
  };
}

describe("GetTermSheetStatusTool", () => {
  it("synthesizes 'none' when nothing is issued", async () => {
    const out = await new GetTermSheetStatusTool({ crm: crmStub(baseEngagement()) }).execute({ engagementId: "e1" });
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;
    expect(out.termSheet.state).toBe("none");
    expect(out.link).toBe("https://crm.example/engagement/e1");
  });

  it("reports 'non_binding_issued' from the termSheetIssued flag", async () => {
    const eng = baseEngagement({ termSheetIssued: true, termSheetDate: "2026-06-01T00:00:00Z" });
    const out = await new GetTermSheetStatusTool({ crm: crmStub(eng) }).execute({ engagementId: "e1" });
    if (out.status !== "ok") throw new Error("expected ok");
    expect(out.termSheet.state).toBe("non_binding_issued");
    expect(out.termSheet.issuedDate).toBe("2026-06-01T00:00:00Z");
  });

  it("reports 'non_binding_issued' from the NonBindingTermSheet milestone even without the flag", async () => {
    const eng = baseEngagement({
      milestones: [{ key: "NonBindingTermSheet", completedAt: "2026-06-02T00:00:00Z", notes: null }],
    });
    const out = await new GetTermSheetStatusTool({ crm: crmStub(eng) }).execute({ engagementId: "e1" });
    if (out.status !== "ok") throw new Error("expected ok");
    expect(out.termSheet.state).toBe("non_binding_issued");
    expect(out.termSheet.issuedDate).toBe("2026-06-02T00:00:00Z");
  });

  it("reports 'executed' when the TermSheetExecuted milestone is present", async () => {
    const eng = baseEngagement({
      termSheetIssued: true,
      milestones: [{ key: "TermSheetExecuted", completedAt: "2026-06-10T00:00:00Z", notes: null }],
    });
    const out = await new GetTermSheetStatusTool({ crm: crmStub(eng) }).execute({ engagementId: "e1" });
    if (out.status !== "ok") throw new Error("expected ok");
    expect(out.termSheet.state).toBe("executed");
    expect(out.termSheet.executedAt).toBe("2026-06-10T00:00:00Z");
  });

  it("rejects when neither engagementId nor both names are given", async () => {
    const out = await new GetTermSheetStatusTool({ crm: crmStub(baseEngagement()) }).execute({ investor: "vantage" });
    expect(out.status).toBe("rejected");
  });

  it("returns not_found when the engagement cannot be loaded", async () => {
    const out = await new GetTermSheetStatusTool({ crm: crmStub(null) }).execute({ engagementId: "gone" });
    expect(out.status).toBe("not_found");
  });
});
