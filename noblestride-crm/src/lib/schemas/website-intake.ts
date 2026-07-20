import { z } from "zod";
import { Sector, Geography, FounderGender, Profitability } from "@prisma/client";
import { isCorporateEmail } from "@/lib/corporate-email";

// website-intake.ts — validation for the Website Intake & Qualification Agent
// (SOW §10). Requiredness matches the §10.1 field table EXACTLY: the wizard's
// legacy `intakeSchema` (src/lib/schemas/intake.ts) hard-requires financials
// the SOW marks optional, so this is a parallel schema rather than an edit —
// the /intake wizard must keep behaving as today until it migrates (see
// TODO-UPDATE-INTAKE-WIZARD.md at the repo root). Missing optional financials
// are handled by qualifyIntake() as NeedsReview reasons, never a rejection.

const AUDITED_YEARS_VALUES = ["0", "1", "2", "3", "4", "5"] as const;
/** §10.1: debt / equity / mezzanine. Multi-select — a raise can mix instruments. */
const INSTRUMENT_VALUES = ["Debt", "Equity", "Mezzanine"] as const;
const YES_NO_VALUES = ["yes", "no"] as const;

const optionalUsd = z
  .number({ error: "Enter a valid number" })
  .nonnegative("Enter a valid number")
  .optional();

/** Signed optional money field — EBITDA / net profit are legitimately negative. */
const optionalSignedUsd = z.number({ error: "Enter a valid number" }).optional();

export const websiteIntakeSchema = z.object({
  // ── Required (§10.1 "Y") ──
  legalName: z.string().trim().min(1, "Legal company name is required"),
  yearFounded: z
    .number({ error: "Year founded is required" })
    .int("Enter a valid year")
    .min(1900, "Enter a valid year")
    .max(new Date().getFullYear(), "Year founded can't be in the future"),
  hqCity: z.string().trim().min(1, "HQ city is required"),
  countries: z.array(z.nativeEnum(Geography)).min(1, "At least one country of operations is required"),
  sectors: z.array(z.nativeEnum(Sector)).min(1, "Select at least one sector"),
  coreProduct: z.string().trim().min(1, "Core product / service is required"),
  description: z.string().trim().min(1, "Company description is required"),
  founderGenders: z.array(z.nativeEnum(FounderGender)).min(1, "Founders' gender is required"),
  foundersNationality: z.string().trim().min(1, "Founders' nationality is required"),
  targetClients: z.string().trim().min(1, "Target clients is required"),
  contactName: z.string().trim().min(1, "Contact name is required"),
  role: z.string().trim().min(1, "Role / position is required"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .refine(isCorporateEmail, "Please use your corporate email address — free providers (Gmail, Yahoo, …) are not accepted"),
  /** Click-wrap acceptance recorded in chat before any sensitive documents are invited. */
  ndaAccepted: z.boolean({ error: "NDA acceptance must be recorded" }),
  raiseUsd: z.number({ error: "Amount raising is required" }).positive("Amount raising is required"),
  instruments: z.array(z.enum(INSTRUMENT_VALUES)).min(1, "At least one instrument is required"),

  // ── Optional (§10.1 "N") ──
  postMoneyValuationUsd: optionalUsd,
  raisedToDateRoundUsd: optionalUsd,
  raisedToDateTotalUsd: optionalUsd,
  existingInvestors: z.string().trim().optional(),
  revenueUsd: optionalUsd,
  revenueForecastUsd: optionalUsd,
  profitability: z.nativeEnum(Profitability).optional(),
  pitchDeckUrl: z.string().trim().optional(),
  website: z.string().trim().optional(),
  originationSource: z.string().trim().optional(),
  applicantNotes: z.string().trim().optional(),

  // ── Not in §10.1 but kept optional — richer answers speed up review ──
  registrationNo: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  hqCountry: z.string().trim().optional(),
  ebitdaUsd: optionalSignedUsd,
  netProfitUsd: optionalSignedUsd,
  totalAssetsUsd: optionalUsd,
  auditedYears: z.enum(AUDITED_YEARS_VALUES).optional(),
  loanBookUsd: optionalUsd,
  existingDebtUsd: optionalUsd,
  useOfFunds: z.string().trim().optional(),
  proposedTimeline: z.string().trim().optional(),
  ownershipSummary: z.string().trim().optional(),
  pepExposure: z.enum(YES_NO_VALUES).optional(),
  governmentOwned: z.enum(YES_NO_VALUES).optional(),
});

export type WebsiteIntakeInput = z.infer<typeof websiteIntakeSchema>;
