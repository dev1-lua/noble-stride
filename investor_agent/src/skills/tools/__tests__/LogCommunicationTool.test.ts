import { describe, it, expect, vi } from "vitest";
import LogCommunicationTool from "../LogCommunicationTool";
import type { CrmClient } from "../../../lib/crm-client";

describe("log_communication", () => {
  it("logs an inbound email", async () => {
    const query = vi.fn(async () => ({ logInvestorCommunication: { ok: true } }));
    const tool = new LogCommunicationTool({
      crm: { baseUrl: "http://x", query } as unknown as CrmClient,
      transportFrom: () => "jo@acme.fund",
    });
    const out = await tool.execute({
      investorId: "inv1",
      direction: "Inbound",
      interactionType: "Email",
      subject: "Criteria update",
      summary: "Ticket size moved to $2-10M",
    });
    expect(out).toEqual({ ok: true });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("logInvestorCommunication"),
      { input: { investorId: "inv1", direction: "Inbound", interactionType: "Email", subject: "Criteria update", summary: "Ticket size moved to $2-10M" } },
    );
  });
});
