// Pure wizard config + per-step validation for /intake.
// Validation reuses intakeSchema so client checks are identical to the
// server's (including the corporate-email refinement). No React here.
// Mirrors src/app/register/register-steps.ts.
import { intakeSchema, LOAN_BOOK_SECTORS } from "@/lib/schemas/intake";

export interface IntakeWizardValues {
  // Step 1 — Company basics
  legalName: string;
  registrationNo: string;
  country: string;
  sectors: string[];
  yearFounded: string;
  website: string;
  pitchDeckUrl: string;
  // Step 2 — Contact person
  contactName: string;
  role: string;
  email: string;
  phone: string;
  // Step 3 — Financial snapshot
  revenueUsd: string;
  ebitdaUsd: string;
  netProfitUsd: string;
  totalAssetsUsd: string;
  auditedYears: string;
  loanBookUsd: string;
  // Step 4 — Funding need
  raiseUsd: string;
  instrument: string;
  useOfFunds: string;
  proposedTimeline: string;
  // Step 5 — Ownership & compliance
  ownershipSummary: string;
  pepExposure: string;
  governmentOwned: string;
  existingDebtUsd: string;
}

export const EMPTY_INTAKE_VALUES: IntakeWizardValues = {
  legalName: "",
  registrationNo: "",
  country: "",
  sectors: [],
  yearFounded: "",
  website: "",
  pitchDeckUrl: "",
  contactName: "",
  role: "",
  email: "",
  phone: "",
  revenueUsd: "",
  ebitdaUsd: "",
  netProfitUsd: "",
  totalAssetsUsd: "",
  auditedYears: "",
  loanBookUsd: "",
  raiseUsd: "",
  instrument: "",
  useOfFunds: "",
  proposedTimeline: "",
  ownershipSummary: "",
  pepExposure: "",
  governmentOwned: "",
  existingDebtUsd: "",
};

/** Fields shown on each input step (design spec §3.2). Review = index 5, no entry. */
export const STEP_FIELDS = [
  ["legalName", "registrationNo", "country", "sectors", "yearFounded", "website", "pitchDeckUrl"],
  ["contactName", "role", "email", "phone"],
  ["revenueUsd", "ebitdaUsd", "netProfitUsd", "totalAssetsUsd", "auditedYears", "loanBookUsd"],
  ["raiseUsd", "instrument", "useOfFunds", "proposedTimeline"],
  ["ownershipSummary", "pepExposure", "governmentOwned", "existingDebtUsd"],
] as const satisfies readonly (readonly (keyof IntakeWizardValues)[])[];

/** 5 input steps + 1 review step. */
export const STEP_COUNT = STEP_FIELDS.length + 1;

/** True once the applicant's chosen sectors require a loan-book figure. */
export function needsLoanBook(sectors: string[]): boolean {
  return sectors.some((s) => (LOAN_BOOK_SECTORS as readonly string[]).includes(s));
}

type StepValidation =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof IntakeWizardValues, string>> };

export function validateStep(stepIndex: number, values: IntakeWizardValues): StepValidation {
  const fields = STEP_FIELDS[stepIndex];
  if (!fields) return { ok: true }; // review step

  const pickShape = Object.fromEntries(fields.map((f) => [f, true]));
  const schema = intakeSchema.pick(pickShape as Parameters<typeof intakeSchema.pick>[0]);
  const subset = Object.fromEntries(fields.map((f) => [f, values[f]]));

  const res = schema.safeParse(subset);
  const errors: Partial<Record<keyof IntakeWizardValues, string>> = {};
  if (!res.success) {
    for (const issue of res.error.issues) {
      const key = issue.path[0] as keyof IntakeWizardValues | undefined;
      if (key && !errors[key]) errors[key] = issue.message;
    }
  }

  // loanBookUsd depends on the step-1 `sectors` field, which the .pick()
  // subset above can't see — checked here instead (mirrored server-side by
  // intakeSubmitSchema's superRefine).
  if (
    (fields as readonly string[]).includes("loanBookUsd") &&
    needsLoanBook(values.sectors) &&
    !values.loanBookUsd.trim()
  ) {
    errors.loanBookUsd = "Loan book value is required for financial-services / banking applicants";
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true };
}
