// Pure wizard config + per-step validation for /register.
// Validation reuses the registration schema so client checks are identical to
// the server's (including the corporate-email refinement). No React here.
import { registrationFieldsSchema, teamMemberSchema } from "@/lib/schemas/registration";

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
  members: { name: string; email: string; phone: string }[];
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
  members: [],
};

/** Fields shown on each input step (light grouping). Review = last index, no entry. */
export const STEP_FIELDS = [
  ["fundName"],
  ["contactPerson", "email", "phone"],
  ["investorType"],
  ["sectorPreference", "geographicFocus"],
  ["dealTypes", "ticketMin", "ticketMax", "currency"],
] as const satisfies readonly (readonly (keyof WizardValues)[])[];

/** Optional team step sits between the input steps and review. */
export const TEAM_STEP_INDEX = STEP_FIELDS.length; // 5

/** 5 input steps + team step + review step. */
export const STEP_COUNT = STEP_FIELDS.length + 2;

type StepValidation =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof WizardValues, string>> };

export function validateStep(stepIndex: number, values: WizardValues): StepValidation {
  if (stepIndex === TEAM_STEP_INDEX) {
    for (const m of values.members) {
      const res = teamMemberSchema.safeParse(m);
      if (!res.success) {
        return { ok: false, errors: { members: res.error.issues[0]?.message ?? "Check the team member details" } };
      }
    }
    const emails = values.members.map((m) => m.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) {
      return { ok: false, errors: { members: "Each team member needs a different email" } };
    }
    if (emails.includes(values.email.trim().toLowerCase())) {
      return { ok: false, errors: { members: "A team member can't reuse the primary contact's email" } };
    }
    return { ok: true };
  }
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
