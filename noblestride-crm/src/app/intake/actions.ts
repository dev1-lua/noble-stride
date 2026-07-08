"use server";
// Server action for the public /intake flow. Thin wrapper over the testable
// core in src/server/onboarding/submit-intake.ts. Mirrors src/app/register/actions.ts.

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { submitIntake } from "@/server/onboarding/submit-intake";

function rawFromFormData(formData: FormData) {
  return {
    legalName: String(formData.get("legalName") ?? "").trim(),
    registrationNo: String(formData.get("registrationNo") ?? "").trim(),
    country: String(formData.get("country") ?? "").trim(),
    sectors: formData.getAll("sectors").map(String),
    yearFounded: String(formData.get("yearFounded") ?? "").trim(),
    website: String(formData.get("website") ?? "").trim(),
    pitchDeckUrl: String(formData.get("pitchDeckUrl") ?? "").trim(),
    contactName: String(formData.get("contactName") ?? "").trim(),
    role: String(formData.get("role") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    revenueUsd: String(formData.get("revenueUsd") ?? "").trim(),
    ebitdaUsd: String(formData.get("ebitdaUsd") ?? "").trim(),
    netProfitUsd: String(formData.get("netProfitUsd") ?? "").trim(),
    totalAssetsUsd: String(formData.get("totalAssetsUsd") ?? "").trim(),
    auditedYears: String(formData.get("auditedYears") ?? "").trim(),
    loanBookUsd: String(formData.get("loanBookUsd") ?? "").trim(),
    raiseUsd: String(formData.get("raiseUsd") ?? "").trim(),
    instrument: String(formData.get("instrument") ?? "").trim(),
    useOfFunds: String(formData.get("useOfFunds") ?? "").trim(),
    proposedTimeline: String(formData.get("proposedTimeline") ?? "").trim(),
    ownershipSummary: String(formData.get("ownershipSummary") ?? "").trim(),
    pepExposure: String(formData.get("pepExposure") ?? "").trim(),
    governmentOwned: String(formData.get("governmentOwned") ?? "").trim(),
    existingDebtUsd: String(formData.get("existingDebtUsd") ?? "").trim(),
  };
}

export interface IntakeActionState {
  error?: string;
}

/**
 * Wizard submit: parses + persists the application, then redirects to the
 * neutral confirmation screen. Returns an inline error (so the client wizard
 * keeps its state) instead of redirecting on failure — same convention as
 * registerWizardAction. No verdict is ever returned to the client.
 */
export async function submitIntakeAction(
  _prev: IntakeActionState,
  formData: FormData,
): Promise<IntakeActionState> {
  const raw = rawFromFormData(formData);

  try {
    await submitIntake(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      return { error: err.issues[0]?.message ?? "Check the form and try again" };
    }
    throw err;
  }
  redirect("/intake?step=done");
}
