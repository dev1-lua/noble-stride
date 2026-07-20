import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, CrmError, type CrmClient } from "../../lib/crm-client";
import { SUBMIT_WEBSITE_INTAKE } from "../../lib/queries";

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
const FOUNDER_GENDERS = ["Male", "Female", "Mixed"] as const;
const INSTRUMENTS = ["Debt", "Equity", "Mezzanine"] as const;
const PROFITABILITY = ["Profitable", "LossMaking"] as const;

// Field set + requiredness mirror SOW §10.1 exactly (see
// noblestride-crm/src/lib/schemas/website-intake.ts — the validation truth).
const inputSchema = z.object({
  // ── Required (§10.1 "Y") ──
  legalName: z.string().min(1).describe("Legal company name"),
  yearFounded: z.number().int().min(1900).describe("Year the company was founded"),
  hqCity: z.string().min(1).describe("City where the company is headquartered"),
  countries: z
    .array(z.enum(GEOGRAPHIES))
    .min(1)
    .describe("Countries of operations mapped to the closest region(s), e.g. Kenya → EastAfrica, Nigeria → WestAfrica"),
  sectors: z.array(z.enum(SECTORS)).min(1).describe("Sector(s) the company operates in"),
  coreProduct: z.string().min(1).describe("Core product / service in one or two sentences"),
  description: z.string().min(1).describe("Short description of the company and what it does"),
  founderGenders: z
    .array(z.enum(FOUNDER_GENDERS))
    .min(1)
    .describe("Founders' gender — use Mixed for a founding team of more than one gender"),
  foundersNationality: z.string().min(1).describe("Founders' nationality / nationalities"),
  targetClients: z.string().min(1).describe("Who the company sells to (target clients / customer segments)"),
  contactName: z.string().min(1).describe("Contact person's full name"),
  role: z.string().min(1).describe("Contact person's role / position"),
  email: z.string().email().describe("Contact's CORPORATE email (free providers like Gmail are rejected by the CRM)"),
  ndaAccepted: z
    .boolean()
    .describe("true ONLY if the visitor explicitly accepted the NDA statement; false if declined or not asked"),
  raiseUsd: z.number().positive().describe("Amount being raised in the current round, USD"),
  instruments: z
    .array(z.enum(INSTRUMENTS))
    .min(1)
    .describe("Type(s) of capital sought: Debt, Equity and/or Mezzanine"),
  conversationSummary: z
    .string()
    .min(1)
    .describe("INTERNAL briefing for the deal team: 3-6 bullets summarizing the conversation + recommended next steps"),

  // ── Optional (§10.1 "N") ──
  postMoneyValuationUsd: z.number().positive().optional().describe("Expected post-money valuation, USD"),
  raisedToDateRoundUsd: z.number().nonnegative().optional().describe("Raised to date in the CURRENT round, USD"),
  raisedToDateTotalUsd: z.number().nonnegative().optional().describe("Raised to date since inception, USD"),
  existingInvestors: z.string().optional().describe("Current investors, including donors and grant makers"),
  revenueUsd: z.number().nonnegative().optional().describe("Revenue last full year, USD"),
  revenueForecastUsd: z.number().nonnegative().optional().describe("Revenue forecast for this year, USD"),
  profitability: z.enum(PROFITABILITY).optional().describe("Whether the company is profitable"),
  pitchDeckUrl: z.string().optional().describe("Link to a pitch deck the visitor pasted as text"),
  website: z.string().optional().describe("Company website, if shared"),
  originationSource: z.string().optional().describe("How they found Noblestride (e.g. website, referral, LinkedIn)"),
  applicantNotes: z.string().optional().describe("Additional information or comments the visitor wants to add"),

  // ── Not in §10.1 — collect if offered, never require ──
  registrationNo: z.string().optional().describe("Company registration number, if shared"),
  phone: z.string().optional().describe("Contact phone number with country code, if shared"),
  hqCountry: z.string().optional().describe("Country of the HQ city, if clear from the conversation"),
  ebitdaUsd: z.number().optional().describe("EBITDA last full year, USD (may be negative)"),
  netProfitUsd: z.number().optional().describe("Net profit last full year, USD (may be negative)"),
  totalAssetsUsd: z.number().positive().optional().describe("Total assets, USD"),
  auditedYears: z.enum(["0", "1", "2", "3", "4", "5"]).optional().describe("Consecutive years of audited accounts"),
  loanBookUsd: z.number().optional().describe("Loan book value, USD — ask for FinancialServices/Banking companies"),
  existingDebtUsd: z.number().optional().describe("Existing debt outstanding, USD"),
  useOfFunds: z.string().optional().describe("What the funds are for (growth, CAPEX, working capital, ...)"),
  proposedTimeline: z.string().optional().describe("When they want to raise / close"),
  ownershipSummary: z.string().optional().describe("Shareholding / ownership structure summary"),
  pepExposure: z.enum(["yes", "no"]).optional().describe("Any politically-exposed-person links, if discussed"),
  governmentOwned: z.enum(["yes", "no"]).optional().describe("Any government ownership, if discussed"),
  qualificationNotes: z
    .string()
    .optional()
    .describe("INTERNAL: qualification signals you noticed, positive or negative (revenue scale, audit history, sector, geography, PEP/state links)"),
  attachmentUrls: z.array(z.string()).optional().describe("URLs of files the visitor uploaded in chat, pitch deck first"),
});

export class SubmitIntakeTool implements LuaTool {
  name = "submit_intake";
  description =
    "Submit a completed website intake application to Noblestride's CRM (SOW §10). Call ONCE per conversation, only after every required field is collected and the NDA statement has been offered. Returns a neutral ack — the visitor must never be told any qualification outcome.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();
    // Strip undefined optionals so the CRM's zod layer sees them as absent.
    const cleaned = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    try {
      await crm.query<{ submitWebsiteIntake: { ok: boolean } }>(SUBMIT_WEBSITE_INTAKE, { input: cleaned });
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
