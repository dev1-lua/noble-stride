import { describe, it, expect, vi } from "vitest";
import CaptureInvestorUpdateTool from "../CaptureInvestorUpdateTool";
import type { CrmClient } from "../../../lib/crm-client";

describe("capture_investor_update", () => {
  it("merges investor + contact changes into proposedFieldsJson", async () => {
    const query = vi.fn(async () => ({ submitInvestorUpdate: { ok: true } }));
    const tool = new CaptureInvestorUpdateTool({
      crm: { baseUrl: "http://x", query } as unknown as CrmClient,
      transportFrom: () => "jo@acme.fund",
    });
    const out = await tool.execute({
      investorId: "inv1",
      summary: "Raised ticket floor to $2M",
      changes: { ticketMin: 2000000, sectorFocus: ["Healthcare"] },
    });
    expect(out).toEqual({ ok: true, note: expect.stringContaining("review") });
    const vars = (query as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      input: { proposedFieldsJson: string; sourceEmail: string };
    };
    expect(JSON.parse(vars.input.proposedFieldsJson)).toEqual({ ticketMin: 2000000, sectorFocus: ["Healthcare"] });
    expect(vars.input.sourceEmail).toBe("jo@acme.fund");
  });
  it("rejects an empty change set before calling the CRM", async () => {
    const query = vi.fn();
    const tool = new CaptureInvestorUpdateTool({
      crm: { baseUrl: "http://x", query } as unknown as CrmClient,
      transportFrom: () => "jo@acme.fund",
    });
    await expect(tool.execute({ investorId: "inv1", summary: "short", changes: {} })).rejects.toThrow(/at least one/i);
    expect(query).not.toHaveBeenCalled();
  });
});
