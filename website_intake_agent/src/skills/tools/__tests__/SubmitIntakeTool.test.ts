import { describe, it, expect, vi } from "vitest";
import { SubmitIntakeTool } from "../SubmitIntakeTool";
import { CrmError } from "../../../lib/crm-client";
import type { CrmClient } from "../../../lib/crm-client";

// §10.1 required fields only — every optional omitted.
const REQUIRED_ONLY = {
  legalName: "Chai Estates Ltd",
  yearFounded: 2015,
  hqCity: "Nairobi",
  countries: ["EastAfrica" as const],
  sectors: ["Agribusiness" as const],
  coreProduct: "Tea processing and export",
  description: "Processes and exports specialty tea.",
  founderGenders: ["Mixed" as const],
  foundersNationality: "Kenyan",
  targetClients: "EU wholesale importers",
  contactName: "Jane Doe",
  role: "CEO",
  email: "jane@chai.example",
  ndaAccepted: true,
  raiseUsd: 1_000_000,
  instruments: ["Debt" as const, "Mezzanine" as const],
  conversationSummary: "Raising 1M USD debt/mezzanine. Next: intro call.",
};

const okCrm = () =>
  ({
    baseUrl: "https://crm.example",
    query: vi.fn(async () => ({ submitWebsiteIntake: { ok: true } })) as CrmClient["query"],
  }) satisfies CrmClient;

describe("SubmitIntakeTool (website intake, SOW §10)", () => {
  it("submits a required-only payload and returns a neutral ok", async () => {
    const crm = okCrm();
    const out = await new SubmitIntakeTool({ crm }).execute(REQUIRED_ONLY);
    expect(out.status).toBe("ok");
    const [, vars] = (crm.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(vars.input.legalName).toBe("Chai Estates Ltd");
    expect(vars.input.instruments).toEqual(["Debt", "Mezzanine"]);
    expect(vars.input.ndaAccepted).toBe(true);
    // undefined optionals stripped so the CRM's zod sees them as absent
    expect(vars.input).not.toHaveProperty("revenueUsd");
    expect(vars.input).not.toHaveProperty("website");
    expect(vars.input).not.toHaveProperty("pepExposure");
  });

  it("passes ndaAccepted: false through (decline is recorded, not dropped)", async () => {
    const crm = okCrm();
    await new SubmitIntakeTool({ crm }).execute({ ...REQUIRED_ONLY, ndaAccepted: false });
    const [, vars] = (crm.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(vars.input.ndaAccepted).toBe(false);
  });

  it("accepts the schema without financials (missing data is NeedsReview server-side, not an error)", () => {
    const tool = new SubmitIntakeTool();
    const parsed = tool.inputSchema.safeParse(REQUIRED_ONLY);
    expect(parsed.success).toBe(true);
  });

  it("schema rejects a payload missing a §10.1 required field", () => {
    const tool = new SubmitIntakeTool();
    const { hqCity: _omitted, ...missingCity } = REQUIRED_ONLY;
    expect(tool.inputSchema.safeParse(missingCity).success).toBe(false);
    const { ndaAccepted: _omitted2, ...missingNda } = REQUIRED_ONLY;
    expect(tool.inputSchema.safeParse(missingNda).success).toBe(false);
  });

  it("returns rejected (not throw) when the CRM rejects validation, so the agent can fix fields", async () => {
    const crm: CrmClient = {
      baseUrl: "https://crm.example",
      query: vi.fn(async () => {
        throw new CrmError("The CRM rejected the request: Please use your corporate email address");
      }) as CrmClient["query"],
    };
    const out = await new SubmitIntakeTool({ crm }).execute(REQUIRED_ONLY);
    expect(out.status).toBe("rejected");
    if (out.status === "rejected") expect(out.message).toContain("corporate email");
  });

  it("rethrows (does not return rejected) when the CRM masks an unexpected server error", async () => {
    const crm: CrmClient = {
      baseUrl: "https://crm.example",
      query: vi.fn(async () => {
        throw new CrmError("The CRM rejected the request: Unexpected error.");
      }) as CrmClient["query"],
    };
    await expect(new SubmitIntakeTool({ crm }).execute(REQUIRED_ONLY)).rejects.toThrow("Unexpected error");
  });

  it("rethrows transport failures (CRM down)", async () => {
    const crm: CrmClient = {
      baseUrl: "https://crm.example",
      query: vi.fn(async () => {
        throw new CrmError("The CRM didn't respond — please try again in a minute.");
      }) as CrmClient["query"],
    };
    await expect(new SubmitIntakeTool({ crm }).execute(REQUIRED_ONLY)).rejects.toThrow("didn't respond");
  });
});
