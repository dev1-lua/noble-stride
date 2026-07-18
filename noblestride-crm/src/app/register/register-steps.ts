// Pure wizard config + per-step validation for /register.
// Validation reuses the registration schema so client checks are identical to
// the server's (including the corporate-email refinement). No React here.
import { registrationFieldsSchema } from "@/lib/schemas/registration";

export interface WizardValues {
  fundName: string;
  contactPerson: string;
  email: string;
  phone: string;
  investorType: string;
  sectorPreference: string[];
  geographicFocus: string[];
  dealTypes: string[];
  // Kept as strings in form state; the schema's z.coerce turns them numeric.
  ticketMin: string;
  ticketMax: string;
  currency: string;
}

export const EMPTY_WIZARD_VALUES: WizardValues = {
  fundName: "",
  contactPerson: "",
  email: "",
  phone: "",
  investorType: "",
  sectorPreference: [],
  geographicFocus: [],
  dealTypes: [],
  ticketMin: "",
  ticketMax: "",
  currency: "USD",
};

/** Fields shown on each input step (light grouping). Review = last index, no entry. */
export const STEP_FIELDS = [
  ["fundName"],
  ["contactPerson", "email", "phone"],
  ["investorType"],
  ["sectorPreference", "geographicFocus"],
  ["dealTypes", "ticketMin", "ticketMax", "currency"],
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
  const schema = registrationFieldsSchema.pick(pickShape as Parameters<typeof registrationFieldsSchema.pick>[0]);
  const subset = Object.fromEntries(fields.map((f) => [f, values[f]]));

  const res = schema.safeParse(subset);
  const errors: Partial<Record<keyof WizardValues, string>> = {};
  if (!res.success) {
    for (const issue of res.error.issues) {
      const key = issue.path[0] as keyof WizardValues | undefined;
      if (key && !errors[key]) errors[key] = issue.message;
    }
  }

  // Cross-field rule (schema-level refine can't survive .pick): max ≥ min,
  // only once both fields individually parse.
  if (
    (fields as readonly string[]).includes("ticketMax") &&
    !errors.ticketMin && !errors.ticketMax &&
    Number(values.ticketMax) < Number(values.ticketMin)
  ) {
    errors.ticketMax = "Maximum ticket must be at least the minimum";
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}
