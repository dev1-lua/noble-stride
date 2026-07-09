// Pure wizard config + per-step validation for /register.
// Validation reuses registrationSchema so client checks are identical to the
// server's (including the corporate-email refinement). No React here.
import { registrationSchema } from "@/lib/schemas/registration";

export interface WizardValues {
  fundName: string;
  contactPerson: string;
  email: string;
  phone: string;
  investorType: string;
  sectorPreference: string[];
  dealType: string;
  dealSizeBand: string;
}

export const EMPTY_WIZARD_VALUES: WizardValues = {
  fundName: "",
  contactPerson: "",
  email: "",
  phone: "",
  investorType: "",
  sectorPreference: [],
  dealType: "",
  dealSizeBand: "",
};

/** Fields shown on each input step (light grouping). Review = index 5, no entry. */
export const STEP_FIELDS = [
  ["fundName"],
  ["contactPerson", "email", "phone"],
  ["investorType"],
  ["sectorPreference"],
  ["dealType", "dealSizeBand"],
] as const satisfies readonly (readonly (keyof WizardValues)[])[];

/** 5 input steps + 1 review step. */
export const STEP_COUNT = STEP_FIELDS.length + 1;

type StepValidation =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof WizardValues, string>> };

export function validateStep(stepIndex: number, values: WizardValues): StepValidation {
  const fields = STEP_FIELDS[stepIndex];
  if (!fields) return { ok: true }; // review step

  const pickShape = Object.fromEntries(fields.map((f) => [f, true]));
  const schema = registrationSchema.pick(pickShape as Parameters<typeof registrationSchema.pick>[0]);
  const subset = Object.fromEntries(fields.map((f) => [f, values[f]]));

  const res = schema.safeParse(subset);
  if (res.success) return { ok: true };

  const errors: Partial<Record<keyof WizardValues, string>> = {};
  for (const issue of res.error.issues) {
    const key = issue.path[0] as keyof WizardValues | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
