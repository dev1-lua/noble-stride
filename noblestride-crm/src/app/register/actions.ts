"use server";
// Server actions for the public /register flow. Thin wrappers over the
// testable core in src/server/onboarding/register-investor.ts.
// Errors round-trip via query params (same convention as portal/partner/refer).

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { registerInvestor, confirmRegistrationOtp, RegistrationError } from "@/server/onboarding/register-investor";

export async function registerAction(formData: FormData): Promise<void> {
  const raw = {
    fundName: String(formData.get("fundName") ?? "").trim(),
    contactPerson: String(formData.get("contactPerson") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    investorType: String(formData.get("investorType") ?? "").trim(),
    sectorPreference: formData.getAll("sectorPreference").map(String),
    dealType: String(formData.get("dealType") ?? "").trim(),
    dealSizeBand: String(formData.get("dealSizeBand") ?? "").trim(),
  };

  let investorId: string;
  try {
    const investor = await registerInvestor(raw);
    investorId = investor.id;
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      redirect(`/register?error=${encodeURIComponent(first?.message ?? "Check the form and try again")}`);
    }
    if (err instanceof RegistrationError) {
      redirect(`/register?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
  redirect(`/register?step=verify&rid=${investorId}`);
}

export async function verifyOtpAction(formData: FormData): Promise<void> {
  const rid = String(formData.get("rid") ?? "");
  if (!rid) redirect("/register");
  try {
    await confirmRegistrationOtp(rid, String(formData.get("emailOtp") ?? ""), String(formData.get("phoneOtp") ?? ""));
  } catch (err) {
    if (err instanceof RegistrationError) {
      redirect(`/register?step=verify&rid=${rid}&error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
  redirect("/register?step=done");
}
