import { describe, it, expect, vi } from "vitest";
import { RequestStatusCodeTool } from "../RequestStatusCodeTool";
import { VerifyStatusCodeTool } from "../VerifyStatusCodeTool";
import { GetClientStatusTool } from "../GetClientStatusTool";
import { REQUEST_STATUS_OTP, VERIFY_STATUS_OTP, CLIENT_STATUS } from "../../../lib/queries";
import { CrmError } from "../../../lib/crm-client";
import type { CrmClient } from "../../../lib/crm-client";

function stubCrm(fn: CrmClient["query"]): CrmClient {
  return { baseUrl: "https://crm.example", query: fn };
}

const SAMPLE_PAYLOAD = {
  companyName: "Chai Estates",
  applicationState: "under_review",
  coarseStage: null,
  stageMessage: "Our team is reviewing your application.",
  ndaStatus: "not_sent",
  engagementAgreementStatus: "not_sent",
  preparedDocuments: [],
  submittedRaise: "USD 1,000,000",
  nextStep: "Sit tight — we'll reach out with next steps.",
  lastUpdated: "2026-07-01T00:00:00.000Z",
};

describe("RequestStatusCodeTool", () => {
  it("always returns {status:'ok'} and passes exact variables", async () => {
    const query = vi.fn(async () => ({ requestClientStatusOtp: { ok: true } })) as CrmClient["query"];
    const crm = stubCrm(query);
    const tool = new RequestStatusCodeTool({ crm });
    const out = await tool.execute({ companyName: "Chai Estates", contactEmail: "jane@chai.example" });
    expect(out).toEqual({ status: "ok" });
    expect(query).toHaveBeenCalledWith(REQUEST_STATUS_OTP, {
      companyName: "Chai Estates",
      contactEmail: "jane@chai.example",
    });
  });

  it("description embeds the anti-enumeration invariant", () => {
    // Brief's exact verbatim description text (binding per task instructions)
    // reads "never reveals whether they matched" rather than the design
    // spec's paraphrase ("never ... exists") — assert the invariant is
    // present using the tool's actual, verbatim wording.
    const tool = new RequestStatusCodeTool();
    expect(tool.description).toMatch(/never/i);
    expect(tool.description).toMatch(/match our records/i);
  });

  it("rethrows transport failures", async () => {
    const crm = stubCrm(vi.fn(async () => {
      throw new CrmError("The CRM didn't respond — please try again in a minute.");
    }) as CrmClient["query"]);
    await expect(
      new RequestStatusCodeTool({ crm }).execute({ companyName: "Chai Estates", contactEmail: "jane@chai.example" }),
    ).rejects.toThrow(CrmError);
  });
});

describe("VerifyStatusCodeTool", () => {
  it("relays the token on ok", async () => {
    const query = vi.fn(async () => ({
      verifyClientStatusOtp: { status: "ok", token: "opaque-token-abc" },
    })) as CrmClient["query"];
    const crm = stubCrm(query);
    const out = await new VerifyStatusCodeTool({ crm }).execute({
      companyName: "Chai Estates",
      contactEmail: "jane@chai.example",
      code: "123456",
    });
    expect(out).toEqual({ status: "ok", token: "opaque-token-abc" });
    expect(query).toHaveBeenCalledWith(VERIFY_STATUS_OTP, {
      companyName: "Chai Estates",
      contactEmail: "jane@chai.example",
      code: "123456",
    });
  });

  it("returns ONLY {status:'failed'} on failure, no other keys", async () => {
    const crm = stubCrm(vi.fn(async () => ({
      verifyClientStatusOtp: { status: "failed", token: null },
    })) as CrmClient["query"]);
    const out = await new VerifyStatusCodeTool({ crm }).execute({
      companyName: "Chai Estates",
      contactEmail: "jane@chai.example",
      code: "000000",
    });
    expect(out).toEqual({ status: "failed" });
    expect(Object.keys(out)).toEqual(["status"]);
  });

  it("rethrows transport failures", async () => {
    const crm = stubCrm(vi.fn(async () => {
      throw new CrmError("The CRM didn't respond — please try again in a minute.");
    }) as CrmClient["query"]);
    await expect(
      new VerifyStatusCodeTool({ crm }).execute({
        companyName: "Chai Estates",
        contactEmail: "jane@chai.example",
        code: "123456",
      }),
    ).rejects.toThrow(CrmError);
  });
});

describe("GetClientStatusTool", () => {
  it("spreads the payload through untouched and never includes the token", async () => {
    const query = vi.fn(async () => ({ clientStatus: SAMPLE_PAYLOAD })) as CrmClient["query"];
    const crm = stubCrm(query);
    const out = await new GetClientStatusTool({ crm }).execute({ token: "opaque-token-abc" });
    expect(out).toEqual({ status: "ok", ...SAMPLE_PAYLOAD });
    if (out.status === "ok") expect(out.applicationState).toBe("under_review");
    expect(out).not.toHaveProperty("token");
    expect(query).toHaveBeenCalledWith(CLIENT_STATUS, { token: "opaque-token-abc" });
  });

  it("maps a verification-expired CRM error to {status:'verification_expired'}", async () => {
    const crm = stubCrm(vi.fn(async () => {
      throw new CrmError("The CRM rejected the request: Verification expired — please verify again.");
    }) as CrmClient["query"]);
    const out = await new GetClientStatusTool({ crm }).execute({ token: "stale-token" });
    expect(out).toEqual({ status: "verification_expired" });
  });

  it("rethrows other CRM/transport failures", async () => {
    const crm = stubCrm(vi.fn(async () => {
      throw new CrmError("The CRM didn't respond — please try again in a minute.");
    }) as CrmClient["query"]);
    await expect(new GetClientStatusTool({ crm }).execute({ token: "opaque-token-abc" })).rejects.toThrow(CrmError);
  });
});
