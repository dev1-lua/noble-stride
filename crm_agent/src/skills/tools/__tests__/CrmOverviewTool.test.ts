// A3 / F5.3 (image20). The tool layer is thin by design — shaping and rendering
// live in lib/overview.ts and are tested there — so this pins the two things
// only the tool owns: it asks the CRM the right question, and a CRM outage
// surfaces as an error the persona can explain rather than a fabricated total.

import { describe, it, expect, vi } from "vitest";
import { CrmOverviewTool } from "../CrmOverviewTool";
import { CrmError, CRM_DOWN_MESSAGE, type CrmClient } from "../../../lib/crm-client";
import type { OverviewRaw } from "../../../lib/overview";

const RAW: OverviewRaw = {
  dashboardStats: {
    activeMandates: { value: 96, delta: 3 },
    activeTransactions: { value: 11, delta: 1 },
    investorsEngagedQtr: { value: 7, delta: 2 },
    capitalRaisedYtd: { value: 12_500_000, delta: 0 },
  },
  pipelineOverview: {
    mandatesByStage: [
      { stage: "NewLead", label: "New Lead", count: 40 },
      { stage: "Signed", label: "Signed", count: 30 },
      { stage: "Closed", label: "Closed", count: 38 },
    ],
    transactionsByStage: [
      { stage: "Open", label: "Open", count: 8 },
      { stage: "TermSheet", label: "Term Sheet", count: 3 },
      { stage: "ClosedWon", label: "Closed Won", count: 2 },
    ],
  },
  investorsCount: 214,
};

function crmStub(raw: unknown): CrmClient {
  return { baseUrl: "https://crm.example", query: vi.fn(async () => raw) } as unknown as CrmClient;
}

describe("crm_overview", () => {
  it("returns the shaped counts, the rendered summary and the dashboard link", async () => {
    const stub = crmStub(RAW);
    const out = await new CrmOverviewTool({ crm: stub }).execute({});
    expect(out.status).toBe("ok");
    expect(out.counts.opportunities.total).toBe(121);
    expect(out.link).toBe("https://crm.example/dashboard");
    expect(out.summary).toContain("121");
    expect(stub.query).toHaveBeenCalledWith(expect.stringContaining("dashboardStats"));
  });

  it("always ships the definition of an opportunity with the total", async () => {
    const out = await new CrmOverviewTool({ crm: crmStub(RAW) }).execute({});
    expect(out.counts.definition.toLowerCase()).toContain("advisory");
    expect(out.summary.toLowerCase()).toContain("advisory assignments are tracked separately");
  });

  it("takes no input, because it is a whole-book question by construction", () => {
    const tool = new CrmOverviewTool();
    expect(tool.inputSchema.parse({})).toEqual({});
  });

  it("propagates a CrmError so the persona can say the CRM is unreachable", async () => {
    const stub = {
      baseUrl: "https://crm.example",
      query: vi.fn(async () => {
        throw new CrmError(CRM_DOWN_MESSAGE);
      }),
    } as unknown as CrmClient;
    await expect(new CrmOverviewTool({ crm: stub }).execute({})).rejects.toThrow(CRM_DOWN_MESSAGE);
  });
});
