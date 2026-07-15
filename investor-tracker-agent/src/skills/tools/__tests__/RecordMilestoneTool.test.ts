import { describe, it, expect, vi } from "vitest";
import { RecordMilestoneTool } from "../RecordMilestoneTool";
import type { CrmClient } from "../../../lib/crm-client";

function crmStub(classification: string) {
  const calls: string[] = [];
  const crm: CrmClient = {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string) => {
      calls.push(document);
      if (document.includes("TrackerEngagement(")) {
        return { engagement: { id: "e1", investor: { id: "i1", name: "Vantage", engagementClassification: classification } } };
      }
      if (document.includes("recordMilestone")) return { recordMilestone: { id: "m1" } };
      if (document.includes("unrecordMilestone")) return { unrecordMilestone: true };
      if (document.includes("logActivity")) return { logActivity: { id: "a1" } };
      throw new Error(`unexpected: ${document.slice(0, 50)}`);
    }) as CrmClient["query"],
  };
  return { crm, calls };
}

const INPUT = { engagementId: "e1", action: "record" as const, key: "NdaExecuted" as const, confirmed: true as const };

describe("RecordMilestoneTool", () => {
  it("schema rejects unconfirmed calls", () => {
    const tool = new RecordMilestoneTool();
    expect(tool.inputSchema.safeParse({ ...INPUT, confirmed: false }).success).toBe(false);
  });

  it("records a milestone and logs the audit note", async () => {
    const { crm, calls } = crmStub("Active");
    const out = await new RecordMilestoneTool({ crm }).execute(INPUT);
    expect(out).toMatchObject({ status: "ok", action: "record", key: "NdaExecuted", auditLogged: true });
    expect(calls.some((d) => d.includes("logActivity"))).toBe(true);
  });

  it("unrecords via the action flag", async () => {
    const { crm, calls } = crmStub("Active");
    const out = await new RecordMilestoneTool({ crm }).execute({ ...INPUT, action: "unrecord" });
    expect(out.status).toBe("ok");
    expect(calls.some((d) => d.includes("unrecordMilestone"))).toBe(true);
  });

  it("refuses milestones for excluded/greylisted investors outright", async () => {
    for (const c of ["Excluded", "Greylisted"]) {
      const { crm, calls } = crmStub(c);
      const out = await new RecordMilestoneTool({ crm }).execute(INPUT);
      expect(out.status).toBe("refused");
      expect(calls.some((d) => d.includes("recordMilestone"))).toBe(false);
    }
  });
});
