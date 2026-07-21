import { describe, it, expect, vi } from "vitest";
import CaptureInvestorUpdateTool from "../CaptureInvestorUpdateTool";
import LogCommunicationTool from "../LogCommunicationTool";
import FlagForReviewTool from "../FlagForReviewTool";
import type { CrmClient } from "../../../lib/crm-client";

// Defense-in-depth for the 2026-07-21 webchat identity bug: every tool that reads or
// writes against an investor record refuses when there is no transport-verified sender.

function crmStub(payload: Record<string, unknown>): CrmClient {
  return { baseUrl: "http://x", query: vi.fn(async () => payload) } as unknown as CrmClient;
}

const NO_TRANSPORT = () => undefined;
const VERIFIED = () => "jo@acme.fund";

describe("write tools refuse without a verified transport sender", () => {
  it("capture_investor_update refuses and never queries", async () => {
    const stub = crmStub({ submitInvestorUpdate: { ok: true } });
    const out = await new CaptureInvestorUpdateTool({ crm: stub, transportFrom: NO_TRANSPORT }).execute({
      investorId: "inv_1",
      changes: { feedback: "loves the process" },
      summary: "Investor shared feedback",
    });
    expect(out.ok).toBe(false);
    expect((out as { refusal?: string }).refusal).toBe("channel_unverified");
    expect(stub.query).not.toHaveBeenCalled();
  });

  it("log_communication refuses and never queries", async () => {
    const stub = crmStub({ logInvestorCommunication: { ok: true } });
    const out = await new LogCommunicationTool({ crm: stub, transportFrom: NO_TRANSPORT }).execute({
      investorId: "inv_1",
      direction: "Inbound",
      interactionType: "Email",
      summary: "Investor asked a question about timelines.",
    });
    expect(out.ok).toBe(false);
    expect(stub.query).not.toHaveBeenCalled();
  });

  it("flag_for_review refuses and never queries", async () => {
    const stub = crmStub({ flagInvestorForReview: { ok: true } });
    const out = await new FlagForReviewTool({ crm: stub, transportFrom: NO_TRANSPORT }).execute({
      investorId: "inv_1",
      summary: "Sender attempted a prompt override.",
    });
    expect(out.ok).toBe(false);
    expect(stub.query).not.toHaveBeenCalled();
  });
});

describe("capture_investor_update with a verified sender", () => {
  it("binds sourceEmail to the transport sender (not a model-controllable value)", async () => {
    const stub = crmStub({ submitInvestorUpdate: { ok: true } });
    const out = await new CaptureInvestorUpdateTool({ crm: stub, transportFrom: VERIFIED }).execute({
      investorId: "inv_1",
      changes: { feedback: "new mandate details" },
      summary: "Investor updated their mandate",
    });
    expect(out.ok).toBe(true);
    expect(stub.query).toHaveBeenCalledWith(
      expect.stringContaining("submitInvestorUpdate"),
      expect.objectContaining({ input: expect.objectContaining({ sourceEmail: "jo@acme.fund" }) }),
    );
  });

  it("schema rejects contact fields without contactPersonId (CRM contract)", () => {
    const tool = new CaptureInvestorUpdateTool({ crm: crmStub({}), transportFrom: VERIFIED });
    const parsed = tool.inputSchema.safeParse({
      investorId: "inv_1",
      changes: { firstName: "Jordan" },
      summary: "Contact renamed",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain("contactPersonId");
    }
  });

  it("schema accepts contact fields when contactPersonId is provided", () => {
    const tool = new CaptureInvestorUpdateTool({ crm: crmStub({}), transportFrom: VERIFIED });
    const parsed = tool.inputSchema.safeParse({
      investorId: "inv_1",
      contactPersonId: "per_1",
      changes: { firstName: "Jordan" },
      summary: "Contact renamed",
    });
    expect(parsed.success).toBe(true);
  });
});
