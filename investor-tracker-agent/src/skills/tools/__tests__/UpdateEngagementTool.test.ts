import { describe, it, expect, vi } from "vitest";
import { UpdateEngagementTool } from "../UpdateEngagementTool";
import { CrmError, CRM_DOWN_MESSAGE, type CrmClient } from "../../../lib/crm-client";

const ENGAGEMENT = {
  id: "e1",
  transactionId: "t1",
  investorId: "i1",
  investor: { id: "i1", name: "Vantage Capital", engagementClassification: "Active" },
};

function crmStub(opts: {
  engagement?: unknown;
  mutationError?: Error;
  auditError?: boolean;
}) {
  const calls: Array<{ document: string; variables?: Record<string, unknown> }> = [];
  const crm: CrmClient = {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string, variables?: Record<string, unknown>) => {
      calls.push({ document, variables });
      if (document.includes("TrackerEngagement(")) {
        return { engagement: opts.engagement !== undefined ? opts.engagement : ENGAGEMENT };
      }
      if (document.includes("updateEngagement")) {
        if (opts.mutationError) throw opts.mutationError;
        return { updateEngagement: { id: "e1", engagementStage: "TermSheet" } };
      }
      if (document.includes("logActivity")) {
        if (opts.auditError) throw new CrmError("The CRM rejected the request: nope");
        return { logActivity: { id: "a1" } };
      }
      throw new Error(`unexpected document: ${document.slice(0, 60)}`);
    }) as CrmClient["query"],
  };
  return { crm, calls };
}

const BASE_INPUT = {
  engagementId: "e1",
  set: { engagementStage: "TermSheet" as const },
  reason: "Term sheet received from Vantage",
  confirmed: true as const,
};

describe("UpdateEngagementTool", () => {
  it("schema rejects unconfirmed calls", () => {
    const tool = new UpdateEngagementTool();
    expect(tool.inputSchema.safeParse({ ...BASE_INPUT, confirmed: false }).success).toBe(false);
    expect(tool.inputSchema.safeParse({ ...BASE_INPUT, confirmed: undefined }).success).toBe(false);
    expect(tool.inputSchema.safeParse(BASE_INPUT).success).toBe(true);
  });

  it("schema rejects an empty set", () => {
    const tool = new UpdateEngagementTool();
    expect(tool.inputSchema.safeParse({ ...BASE_INPUT, set: {} }).success).toBe(false);
  });

  it("echoes the engagement's own transactionId/investorId into the mutation input", async () => {
    const { crm, calls } = crmStub({});
    const out = await new UpdateEngagementTool({ crm }).execute(BASE_INPUT);
    expect(out.status).toBe("ok");
    const mutation = calls.find((c) => c.document.includes("updateEngagement"));
    expect(mutation?.variables?.input).toMatchObject({
      transactionId: "t1",
      investorId: "i1",
      engagementStage: "TermSheet",
    });
  });

  it("writes an audit Note and reports auditLogged: false when only the audit fails", async () => {
    const { crm, calls } = crmStub({ auditError: true });
    const out = await new UpdateEngagementTool({ crm }).execute(BASE_INPUT);
    expect(out.status).toBe("ok");
    if (out.status === "ok") expect(out.auditLogged).toBe(false);
    const audit = calls.find((c) => c.document.includes("logActivity"));
    expect((audit?.variables?.input as Record<string, unknown>).engagementId).toBe("e1");
  });

  it("refuses to advance an excluded investor, allows winding down", async () => {
    const excluded = { ...ENGAGEMENT, investor: { ...ENGAGEMENT.investor, engagementClassification: "Excluded" } };
    const { crm } = crmStub({ engagement: excluded });
    const tool = new UpdateEngagementTool({ crm });

    const advance = await tool.execute(BASE_INPUT);
    expect(advance.status).toBe("refused");

    const windDown = await tool.execute({ ...BASE_INPUT, set: { engagementStage: "Declined" } });
    expect(windDown.status).toBe("ok");
  });

  it("relays server-side rule blocks (NDA guard) as status blocked", async () => {
    const { crm } = crmStub({
      mutationError: new CrmError("The CRM rejected the request: An NDA must be recorded before this stage."),
    });
    const out = await new UpdateEngagementTool({ crm }).execute(BASE_INPUT);
    expect(out.status).toBe("blocked");
    if (out.status === "blocked") expect(out.message).toContain("NDA");
  });

  it("rethrows transport failures instead of mislabeling them blocked", async () => {
    const { crm } = crmStub({ mutationError: new CrmError(CRM_DOWN_MESSAGE, "HTTP 503") });
    await expect(new UpdateEngagementTool({ crm }).execute(BASE_INPUT)).rejects.toThrow(CRM_DOWN_MESSAGE);
  });

  it("returns not_found when the engagement does not exist", async () => {
    const { crm } = crmStub({ engagement: null });
    const out = await new UpdateEngagementTool({ crm }).execute(BASE_INPUT);
    expect(out.status).toBe("not_found");
  });
});
