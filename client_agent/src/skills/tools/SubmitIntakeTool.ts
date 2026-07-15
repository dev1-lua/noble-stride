import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, CrmError, type CrmClient } from "../../lib/crm-client";
import { SUBMIT_CLIENT_INTAKE } from "../../lib/queries";

// Prisma enum values, mirrored so the model produces valid inputs directly.
const GEOGRAPHIES = [
  "EastAfrica", "WestAfrica", "SouthernAfrica", "SubSaharanAfrica", "PanAfrica",
  "NorthAfrica", "FrancophoneAfrica", "MENA", "Europe", "USA", "Global",
] as const;
const SECTORS = [
  "Agribusiness", "FinancialServices", "FMCG", "Manufacturing", "RenewableEnergy",
  "Technology", "Healthcare", "Banking", "RealEstate", "Education", "Infrastructure",
  "Aviation", "Construction", "Hospitality", "Leasing", "MediaEntertainment",
  "Services", "TransportLogistics", "WaterSanitation", "Energy", "OilAndGas",
  "Mining", "Gambling", "Alcohol", "Tobacco",
] as const;

const inputSchema = z.object({
  legalName: z.string().min(1).describe("Legal company name"),
  registrationNo: z.string().min(1).describe("Company registration number"),
  country: z.enum(GEOGRAPHIES).describe("Closest region for the HQ / primary operations"),
  sectors: z.array(z.enum(SECTORS)).min(1).describe("Sector(s) the company operates in"),
  yearFounded: z.number().int().min(1900).describe("Year the company was founded"),
  website: z.string().optional().describe("Company website, if shared"),
  pitchDeckUrl: z.string().optional().describe("Link to a pitch deck the visitor pasted as text"),
  contactName: z.string().min(1).describe("Contact person's full name"),
  role: z.string().min(1).describe("Contact person's role / position"),
  email: z.string().email().describe("Contact's CORPORATE email (free providers like Gmail are rejected by the CRM)"),
  phone: z.string().min(7).describe("Contact phone number with country code"),
  revenueUsd: z.number().positive().describe("Revenue last full year, USD"),
  ebitdaUsd: z.number().describe("EBITDA last full year, USD (may be negative)"),
  netProfitUsd: z.number().describe("Net profit last full year, USD (may be negative)"),
  totalAssetsUsd: z.number().positive().describe("Total assets, USD"),
  auditedYears: z.enum(["0", "1", "2", "3", "4", "5"]).describe("Consecutive years of audited accounts"),
  loanBookUsd: z.number().optional().describe("Loan book value, USD — required for FinancialServices/Banking companies"),
  raiseUsd: z.number().positive().describe("Amount being raised in the current round, USD"),
  instrument: z.enum(["Debt", "Equity", "Both"]).describe("Instrument sought"),
  useOfFunds: z.string().min(1).describe("What the funds are for (growth, CAPEX, working capital, ...)"),
  proposedTimeline: z.string().min(1).describe("When they want to raise / close"),
  ownershipSummary: z.string().min(1).describe("Shareholding / ownership structure summary"),
  pepExposure: z.enum(["yes", "no"]).describe("Any politically-exposed-person links"),
  governmentOwned: z.enum(["yes", "no"]).describe("Any government ownership"),
  existingDebtUsd: z.number().optional().describe("Existing debt outstanding, USD"),
  conversationSummary: z
    .string()
    .min(1)
    .describe("INTERNAL briefing for the deal team: 3-6 bullets summarizing the conversation + recommended next steps"),
  qualificationNotes: z
    .string()
    .optional()
    .describe("INTERNAL: qualification signals you noticed, positive or negative (revenue scale, audit history, sector, geography, PEP/state links)"),
  attachmentUrls: z.array(z.string()).optional().describe("URLs of files the visitor uploaded in chat, pitch deck first"),
});

export class SubmitIntakeTool implements LuaTool {
  name = "submit_intake";
  description =
    "Submit a completed intake application to Noblestride's CRM. Call ONCE per conversation, only after the required fields are collected. Returns a neutral ack — the visitor must never be told any qualification outcome.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();
    // Strip undefined optionals so the CRM's zod layer sees them as absent.
    const cleaned = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    try {
      await crm.query<{ submitClientIntake: { ok: boolean } }>(SUBMIT_CLIENT_INTAKE, { input: cleaned });
    } catch (err) {
      if (
        err instanceof CrmError &&
        err.message.startsWith("The CRM rejected") &&
        !err.message.includes("Unexpected error")
      ) {
        return { status: "rejected" as const, message: err.message };
      }
      throw err;
    }
    return {
      status: "ok" as const,
      message: "Application submitted. The team will review it and be in touch — do not promise any outcome or timeline beyond that.",
    };
  }
}
