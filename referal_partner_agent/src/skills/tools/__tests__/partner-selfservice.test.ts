import { describe, it, expect, vi } from "vitest";
import type { CrmClient } from "../../../lib/crm-client";
import { CrmError } from "../../../lib/crm-client";
import { VerifyPartnerCodeTool } from "../VerifyPartnerCodeTool";
import { GetPartnerSelfViewTool } from "../GetPartnerSelfViewTool";
import { UpdatePartnerSelfInfoTool } from "../UpdatePartnerSelfInfoTool";

function crmReturning(data: unknown, spy?: (doc: string, vars?: Record<string, unknown>) => void): CrmClient {
  return {
    baseUrl: "http://crm.test",
    query: (async (doc: string, vars?: Record<string, unknown>) => {
      spy?.(doc, vars);
      return data;
    }) as CrmClient["query"],
  };
}

function crmThrowing(err: unknown): CrmClient {
  return {
    baseUrl: "http://crm.test",
    query: (async () => {
      throw err;
    }) as CrmClient["query"],
  };
}

describe("VerifyPartnerCodeTool", () => {
  it("returns ok + token on success", async () => {
    const crm = crmReturning({ verifyPartnerAccessCode: { status: "ok", token: "tok_123" } });
    const res = await new VerifyPartnerCodeTool({ crm }).execute({ partnerRef: "Jane Advisory", code: "abc" });
    expect(res).toEqual({ status: "ok", token: "tok_123" });
  });

  it("collapses any non-ok result to failed (anti-enumeration)", async () => {
    const crm = crmReturning({ verifyPartnerAccessCode: { status: "failed" } });
    const res = await new VerifyPartnerCodeTool({ crm }).execute({ partnerRef: "nobody", code: "wrong" });
    expect(res).toEqual({ status: "failed" });
  });
});

describe("GetPartnerSelfViewTool", () => {
  it("returns the whitelisted self-view on a valid token", async () => {
    const partner = {
      name: "Jane Advisory",
      organization: "JA LLP",
      email: "jane@ja.co",
      phone: null,
      advisorType: "Lawyer",
      feeAgreementOnFile: true,
      referredDealCount: 1,
      referredDeals: [{ dealName: "Project Busoga", stage: "DueDiligence", status: "Open" }],
    };
    const res = await new GetPartnerSelfViewTool({ crm: crmReturning({ partnerSelfView: partner }) }).execute({
      token: "tok",
    });
    expect(res).toEqual({ status: "ok", partner });
  });

  it("maps a bad/expired token (CRM rejection) to verification_expired", async () => {
    const crm = crmThrowing(new CrmError("Verification expired — please verify again."));
    const res = await new GetPartnerSelfViewTool({ crm }).execute({ token: "stale" });
    expect(res.status).toBe("verification_expired");
  });
});

describe("UpdatePartnerSelfInfoTool", () => {
  it("submits only the provided contact fields as JSON and acks", async () => {
    const calls: Array<{ doc: string; vars?: Record<string, unknown> }> = [];
    const crm = crmReturning({ submitPartnerSelfUpdate: { ok: true } }, (doc, vars) => calls.push({ doc, vars }));
    const res = await new UpdatePartnerSelfInfoTool({ crm }).execute({
      token: "tok",
      set: { email: "new@ja.co", phone: undefined },
      summary: "Update my email",
    });
    expect(res.status).toBe("ok");
    const input = calls[0].vars?.input as { proposedFieldsJson: string };
    expect(JSON.parse(input.proposedFieldsJson)).toEqual({ email: "new@ja.co" }); // undefined phone dropped
  });

  it("maps a bad/expired token to verification_expired", async () => {
    const crm = crmThrowing(new CrmError("Verification expired — please verify again."));
    const res = await new UpdatePartnerSelfInfoTool({ crm }).execute({
      token: "stale",
      set: { phone: "+254700000000" },
      summary: "x",
    });
    expect(res.status).toBe("verification_expired");
  });
});
