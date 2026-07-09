// Email guardrails (real-auth spec §6): who may hold which kind of account.
// - @noblestride.capital (exact) → internal staff
// - other corporate domains → investor-eligible ("external")
// - free providers / malformed / greylisted → blocked
// Pure classify + async variant that adds the BlockedRegistration greylist.

import { emailDomain, isFreeEmailDomain } from "@/lib/corporate-email";
import { isRegistrationBlocked } from "@/server/onboarding/register-investor";

export const INTERNAL_EMAIL_DOMAIN = "noblestride.capital";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type EmailClass =
  | { kind: "internal" }
  | { kind: "external" }
  | { kind: "blocked"; reason: "invalid" | "free-provider" };

export function classifyEmail(email: string): EmailClass {
  const domain = emailDomain(normalizeEmail(email));
  if (!domain) return { kind: "blocked", reason: "invalid" };
  if (domain === INTERNAL_EMAIL_DOMAIN) return { kind: "internal" };
  if (isFreeEmailDomain(domain)) return { kind: "blocked", reason: "free-provider" };
  return { kind: "external" };
}

export type SignupEmailClass = EmailClass | { kind: "blocked"; reason: "greylisted" };

/** classifyEmail + the BlockedRegistration greylist (DB). */
export async function classifyEmailForSignup(email: string): Promise<SignupEmailClass> {
  const base = classifyEmail(email);
  if (base.kind !== "external") return base;
  if (await isRegistrationBlocked(normalizeEmail(email))) {
    return { kind: "blocked", reason: "greylisted" };
  }
  return base;
}
