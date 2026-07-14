import { describe, it, expect, vi } from "vitest";
import { SubmitIntakeTool } from "../SubmitIntakeTool";
import { CrmError } from "../../../lib/crm-client";
import type { CrmClient } from "../../../lib/crm-client";

const VALID = {
  legalName: "Chai Estates Ltd",
  registrationNo: "C-123",
  country: "EastAfrica" as const,
  sectors: ["Agribusiness" as const],
  yearFounded: 2015,
  contactName: "Jane Doe",
  role: "CEO",
  email: "jane@chai.example",
  phone: "+254700000000",
  revenueUsd: 2_000_000,
  ebitdaUsd: 300_000,
  netProfitUsd: 150_000,
  totalAssetsUsd: 5_000_000,
  auditedYears: "3" as const,
  raiseUsd: 1_000_000,
  instrument: "Debt" as const,
  useOfFunds: "Working capital",
  proposedTimeline: "Q4 2026",
  ownershipSummary: "Founders 100%",
  pepExposure: "no" as const,
  governmentOwned: "no" as const,
  conversationSummary: "Raising 1M USD debt. Next: intro call.",
};

describe("SubmitIntakeTool", () => {
  it("submits and returns a neutral ok", async () => {
    const crm: CrmClient = {
      baseUrl: "https://crm.example",
      query: vi.fn(async () => ({ submitClientIntake: { ok: true } })) as CrmClient["query"],
    };
    const out = await new SubmitIntakeTool({ crm }).execute(VALID);
    expect(out.status).toBe("ok");
    const [, vars] = (crm.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(vars.input.legalName).toBe("Chai Estates Ltd");
    expect(vars.input).not.toHaveProperty("website"); // undefined optionals stripped
  });

  it("returns rejected (not throw) when the CRM rejects validation, so the agent can fix fields", async () => {
    const crm: CrmClient = {
      baseUrl: "https://crm.example",
      query: vi.fn(async () => {
        throw new CrmError("The CRM rejected the request: Please use your corporate email address");
      }) as CrmClient["query"],
    };
    const out = await new SubmitIntakeTool({ crm }).execute(VALID);
    expect(out.status).toBe("rejected");
    if (out.status === "rejected") expect(out.message).toContain("corporate email");
  });

  it("rethrows (does not return rejected) when the CRM masks an unexpected server error, so it doesn't route to field-retry", async () => {
    const crm: CrmClient = {
      baseUrl: "https://crm.example",
      query: vi.fn(async () => {
        throw new CrmError("The CRM rejected the request: Unexpected error.");
      }) as CrmClient["query"],
    };
    await expect(new SubmitIntakeTool({ crm }).execute(VALID)).rejects.toThrow("Unexpected error");
  });

  it("rethrows transport failures (CRM down)", async () => {
    const crm: CrmClient = {
      baseUrl: "https://crm.example",
      query: vi.fn(async () => {
        throw new CrmError("The CRM didn't respond — please try again in a minute.");
      }) as CrmClient["query"],
    };
    await expect(new SubmitIntakeTool({ crm }).execute(VALID)).rejects.toThrow("didn't respond");
  });
});
