import { describe, it, expect, vi } from "vitest";
import { CreateFollowupTaskTool, addBusinessDays } from "../CreateFollowupTaskTool";
import type { CrmClient } from "../../../lib/crm-client";

const NOW = new Date("2026-07-16T08:00:00Z"); // a Thursday

function crmStub() {
  const created: Record<string, unknown>[] = [];
  const crm: CrmClient = {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string, variables?: Record<string, unknown>) => {
      if (document.includes("TrackerEngagement(")) {
        return { engagement: { id: "e1", transactionId: "t1", investorId: "i1" } };
      }
      if (document.includes("createTask")) {
        created.push(variables?.input as Record<string, unknown>);
        return { createTask: { id: "task1", title: "x", status: "NotStarted", dueAt: null } };
      }
      throw new Error(`unexpected: ${document.slice(0, 50)}`);
    }) as CrmClient["query"],
  };
  return { crm, created };
}

describe("addBusinessDays", () => {
  it("skips weekends", () => {
    // Thursday + 3 business days = Tuesday
    expect(addBusinessDays(NOW, 3).toISOString().slice(0, 10)).toBe("2026-07-21");
  });
});

describe("CreateFollowupTaskTool", () => {
  it("schema rejects unconfirmed calls", () => {
    const tool = new CreateFollowupTaskTool();
    expect(tool.inputSchema.safeParse({ title: "Chase", confirmed: false }).success).toBe(false);
  });

  it("links the task via engagementId, defaults dueAt to +3 business days, attributes itself", async () => {
    const { crm, created } = crmStub();
    const out = await new CreateFollowupTaskTool({ crm, now: () => NOW }).execute({
      title: "Chase Vantage on the term sheet",
      engagementId: "e1",
      confirmed: true,
    });
    expect(out.status).toBe("ok");
    expect(created[0]).toMatchObject({ transactionId: "t1", investorId: "i1", status: "NotStarted", source: "Other" });
    expect(String(created[0].dueAt).slice(0, 10)).toBe("2026-07-21");
    expect(String(created[0].body)).toContain("Created by Investor Tracker Agent");
    expect(String(created[0].body)).toContain("https://crm.example/engagement/e1");
  });

  it("creates an unlinked task when no identifiers are given", async () => {
    const { crm, created } = crmStub();
    const out = await new CreateFollowupTaskTool({ crm, now: () => NOW }).execute({
      title: "General follow-up",
      confirmed: true,
    });
    expect(out.status).toBe("ok");
    expect(created[0].transactionId).toBeUndefined();
    expect(created[0].investorId).toBeUndefined();
  });

  it("respects an explicit dueAt", async () => {
    const { crm, created } = crmStub();
    await new CreateFollowupTaskTool({ crm, now: () => NOW }).execute({
      title: "Chase",
      dueAt: "2026-08-01T00:00:00Z",
      confirmed: true,
    });
    expect(created[0].dueAt).toBe("2026-08-01T00:00:00Z");
  });
});
