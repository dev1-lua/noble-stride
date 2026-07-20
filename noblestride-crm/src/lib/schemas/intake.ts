import { z } from "zod";
import { Sector, Geography } from "@prisma/client";
import { isCorporateEmail } from "@/lib/corporate-email";
import { requiredPhone } from "@/lib/schemas/phone";

/** Sectors that require a loan-book figure on the financial-snapshot step (intake spec §3.2). */
export const LOAN_BOOK_SECTORS = ["FinancialServices", "Banking"] as const;

const AUDITED_YEARS_VALUES = ["0", "1", "2", "3", "4", "5"] as const;
const INSTRUMENT_VALUES = ["Debt", "Equity", "Both"] as const;
const YES_NO_VALUES = ["yes", "no"] as const;

/** Blank string -> undefined so optional USD fields don't fail as "0" or "NaN". */
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const requiredUsd = (message: string) =>
  z.preprocess(blankToUndefined, z.coerce.number({ error: message }).positive(message));

/**
 * Required money field that allows zero/negative values — for figures like
 * EBITDA and net profit that are legitimately non-positive for loss-making
 * or growth-stage companies. A blank value still fails as "required"; only
 * the positivity constraint is dropped versus `requiredUsd`.
 */
const requiredSignedUsd = (message: string) =>
  z.preprocess(blankToUndefined, z.coerce.number({ error: message }));

const optionalUsd = z.preprocess(
  blankToUndefined,
  z.coerce.number({ error: "Enter a valid number" }).nonnegative("Enter a valid number").optional(),
);

/**
 * Public client-intake fields (intake spec §3.2, 5 input steps + review).
 * Step components use `.pick()` on this same shape so client and server
 * validation never drift — mirrors `src/lib/schemas/registration.ts`.
 */
export const intakeSchema = z.object({
  // Step 1 — Company basics
  legalName: z.string().trim().min(1, "Legal company name is required"),
  registrationNo: z.string().trim().min(1, "Registration number is required"),
  country: z.nativeEnum(Geography),
  sectors: z.array(z.nativeEnum(Sector)).min(1, "Select at least one sector"),
  yearFounded: z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ error: "Year founded is required" })
      .int("Enter a valid year")
      .min(1900, "Enter a valid year")
      .max(new Date().getFullYear(), "Year founded can't be in the future"),
  ),
  website: z.string().trim().optional(),
  pitchDeckUrl: z.string().trim().optional(),

  // Step 2 — Contact person
  contactName: z.string().trim().min(1, "Contact name is required"),
  role: z.string().trim().min(1, "Role / position is required"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .refine(isCorporateEmail, "Please use your corporate email address — free providers (Gmail, Yahoo, …) are not accepted"),
  phone: requiredPhone("Phone number is required"),

  // Step 3 — Financial snapshot
  revenueUsd: requiredUsd("Revenue for the last full year is required"),
  ebitdaUsd: requiredSignedUsd("EBITDA for the last full year is required"),
  netProfitUsd: requiredSignedUsd("Net profit is required"),
  totalAssetsUsd: requiredUsd("Total assets is required"),
  auditedYears: z.enum(AUDITED_YEARS_VALUES),
  /** Only required when `sectors` includes a LOAN_BOOK_SECTORS value — see intakeSubmitSchema. */
  loanBookUsd: optionalUsd,

  // Step 4 — Funding need
  raiseUsd: requiredUsd("Amount sought is required"),
  instrument: z.enum(INSTRUMENT_VALUES),
  useOfFunds: z.string().trim().min(1, "Use of funds is required"),
  proposedTimeline: z.string().trim().min(1, "Proposed timeline is required"),

  // Step 5 — Ownership & compliance
  ownershipSummary: z.string().trim().min(1, "Shareholding summary is required"),
  pepExposure: z.enum(YES_NO_VALUES),
  governmentOwned: z.enum(YES_NO_VALUES),
  existingDebtUsd: optionalUsd,
});

export type IntakeInput = z.infer<typeof intakeSchema>;

/**
 * Full-submission schema: layers the one cross-field rule the per-step
 * `.pick()` validation can't express on its own (loanBookUsd depends on the
 * step-1 `sectors` field). Used by the server action; `intakeSchema` (base,
 * unrefined) is what the wizard's `.pick()` per-step validation uses.
 */
export const intakeSubmitSchema = intakeSchema.superRefine((data, ctx) => {
  const needsLoanBook = data.sectors.some((s) => (LOAN_BOOK_SECTORS as readonly string[]).includes(s));
  if (needsLoanBook && data.loanBookUsd == null) {
    ctx.addIssue({
      code: "custom",
      path: ["loanBookUsd"],
      message: "Loan book value is required for financial-services / banking applicants",
    });
  }
});
