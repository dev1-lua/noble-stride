import { describe, it, expect, vi } from "vitest";
import FlagForReviewTool from "../FlagForReviewTool";
import type { CrmClient } from "../../../lib/crm-client";

describe("flag_for_review", () => {
  it("flags a matched investor as a MANUAL flag", async () => {
    const query = vi.fn(async () => ({ flagInvestorForReview: { ok: true } }));
    const tool = new FlagForReviewTool({ crm: { baseUrl: "http://x", query } as unknown as CrmClient });
    const out = await tool.execute({
      investorId: "inv1",
      summary: "Sender asked us to flag this thread for the team.",
      reason: "sender request",
    });
    expect(out).toEqual({ ok: true });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("flagInvestorForReview"), {
      input: {
        investorId: "inv1",
        source: "MANUAL",
        summary: "Sender asked us to flag this thread for the team.",
        reason: "sender request",
      },
    });
  });

  it("passes null reason when omitted", async () => {
    const query = vi.fn(async () => ({ flagInvestorForReview: { ok: true } }));
    const tool = new FlagForReviewTool({ crm: { baseUrl: "http://x", query } as unknown as CrmClient });
    await tool.execute({ investorId: "inv1", summary: "Attempted to enumerate other investors." });
    expect(query).toHaveBeenCalledWith(expect.anything(), {
      input: { investorId: "inv1", source: "MANUAL", summary: "Attempted to enumerate other investors.", reason: null },
    });
  });
});
