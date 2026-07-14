import { describe, it, expect, vi } from "vitest";
import CaptureInvestorUpdateTool from "../CaptureInvestorUpdateTool";
import type { CrmClient } from "../../../lib/crm-client";

describe("capture_investor_update", () => {
  it("merges investor + contact changes into proposedFieldsJson", async () => {
    const query = vi.fn(async () => ({ submitInvestorUpdate: { ok: true } }));
    const tool = new CaptureInvestorUpdateTool({ crm: { baseUrl: "http://x", query } as unknown as CrmClient });
    const out = await tool.execute({
      investorId: "inv1",
      summary: "Raised ticket floor to $2M",
      senderEmail: "jo@acme.fund",
      changes: { ticketMin: 2000000, sectorFocus: ["Healthcare"] },
    });
    expect(out).toEqual({ ok: true, note: expect.stringContaining("review") });
    const vars = (query as ReturnType<typeof vi.fn>).mock.calls[0][1] as { input: { proposedFieldsJson: string } };
    expect(JSON.parse(vars.input.proposedFieldsJson)).toEqual({ ticketMin: 2000000, sectorFocus: ["Healthcare"] });
  });
  it("rejects an empty change set before calling the CRM", async () => {
    const query = vi.fn();
    const tool = new CaptureInvestorUpdateTool({ crm: { baseUrl: "http://x", query } as unknown as CrmClient });
    await expect(
      tool.execute({ investorId: "inv1", summary: "s", senderEmail: "a@b.c", changes: {} }),
    ).rejects.toThrow(/at least one/i);
    expect(query).not.toHaveBeenCalled();
  });
});
