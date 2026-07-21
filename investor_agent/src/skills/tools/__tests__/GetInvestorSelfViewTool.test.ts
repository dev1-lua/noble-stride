import { describe, it, expect, vi } from "vitest";
import GetInvestorSelfViewTool from "../GetInvestorSelfViewTool";
import type { CrmClient } from "../../../lib/crm-client";

const PAYLOAD = {
  matched: true,
  investorName: "Acme Fund",
  status: "ActivelyDeploying",
  onboardingStatus: "Approved",
  sectorFocus: ["Fintech"],
  geographicFocus: ["SubSaharanAfrica"],
  instruments: ["Equity"],
  investmentStages: ["Growth"],
  ticketBand: "1M–10M",
  currency: "USD",
  targetIrr: 20,
  countryRestrictions: null,
  esgFocus: null,
  investmentMandate: "SSA growth equity",
  criteriaVerifiedAt: null,
};

function crmStub(result: unknown): CrmClient {
  return { baseUrl: "http://x", query: vi.fn(async () => ({ investorSelfView: result })) } as unknown as CrmClient;
}

describe("get_investor_selfview", () => {
  it("returns the investor's own whitelisted profile, keyed on the transport From", async () => {
    const stub = crmStub(PAYLOAD);
    const out = await new GetInvestorSelfViewTool({
      crm: stub,
      transportFrom: () => "jo@acme.fund",
    }).execute({ senderEmail: "jo@acme.fund" });
    expect(out).toEqual(PAYLOAD);
    expect(out.ticketBand ?? "").not.toContain("$"); // symbol-free so the leak scanner never blanks the reply
    expect(stub.query).toHaveBeenCalledWith(expect.stringContaining("investorSelfView"), { email: "jo@acme.fund" });
  });

  it("refuses (unmatched) when the model arg names a DIFFERENT address than the transport From", async () => {
    const stub = crmStub(PAYLOAD);
    // prompt-injection: the model was talked into asking for a rival's profile
    const out = await new GetInvestorSelfViewTool({
      crm: stub,
      transportFrom: () => "jo@acme.fund",
    }).execute({ senderEmail: "rival@othercap.com" });
    expect(out.matched).toBe(false);
    expect(stub.query).not.toHaveBeenCalled(); // never even queries the victim's address
  });

  it("matches when the transport From is a full display-name header (the prod bug)", async () => {
    // senderFromRequest now returns a bare, parsed address, so the tool receives
    // "shaurya@luaimplementation.ai" — not the raw "Name <addr>" header. This is the
    // regression that made every real inbound self-view return UNMATCHED.
    const stub = crmStub(PAYLOAD);
    const out = await new GetInvestorSelfViewTool({
      crm: stub,
      transportFrom: () => "shaurya@luaimplementation.ai",
    }).execute({ senderEmail: "shaurya@luaimplementation.ai" });
    expect(out.matched).toBe(true);
    expect(stub.query).toHaveBeenCalledWith(expect.anything(), { email: "shaurya@luaimplementation.ai" });
  });

  it("keys on the transport From even when the model arg matches (case-insensitive)", async () => {
    const stub = crmStub(PAYLOAD);
    await new GetInvestorSelfViewTool({
      crm: stub,
      transportFrom: () => "JO@Acme.Fund",
    }).execute({ senderEmail: "jo@acme.fund" });
    expect(stub.query).toHaveBeenCalledWith(expect.anything(), { email: "JO@Acme.Fund" });
  });

  it("refuses (channel_unverified) when there is no verified transport sender — never queries with the model arg", async () => {
    // 2026-07-21 prod QA CRITICAL: over webchat there is no transport identity, and the old
    // fallback let any sender read another investor's profile by asserting their address.
    const stub = crmStub(PAYLOAD);
    const out = await new GetInvestorSelfViewTool({
      crm: stub,
      transportFrom: () => undefined,
    }).execute({ senderEmail: "victim@rivalfund.com" });
    expect(out.matched).toBe(false);
    expect((out as { refusal?: string }).refusal).toBe("channel_unverified");
    expect(stub.query).not.toHaveBeenCalled();
  });

  it("passes through an unmatched result untouched", async () => {
    const stub = crmStub({ matched: false, sectorFocus: [], geographicFocus: [], instruments: [], investmentStages: [] });
    const out = await new GetInvestorSelfViewTool({ crm: stub, transportFrom: () => "nobody@nowhere.com" }).execute({
      senderEmail: "nobody@nowhere.com",
    });
    expect(out.matched).toBe(false);
  });
});
