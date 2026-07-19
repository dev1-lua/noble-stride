"use server";
// Server actions for the public /register flow (real-auth spec §10).
// Email-first fork: internal → staff signup; existing investor contact →
// password-only account request; new investor → wizard; blocked → error.

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import { classifyEmailForSignup, normalizeEmail } from "@/server/auth/guardrails";
import { AuthFlowError, signupExistingContact, signupInternal } from "@/server/auth/accounts";
import { registerInvestorWithAccount, RegistrationError } from "@/server/onboarding/register-investor";
import { rateLimit } from "@/server/auth/rate-limit";

export interface WizardActionState {
  error?: string;
}

async function checkRate(scope: string): Promise<boolean> {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return rateLimit(`${scope}:${ip}`, { max: 10, windowMs: 10 * 60 * 1000 });
}

/** Step 0: classify the email and route to the right path. */
export async function routeEmailAction(formData: FormData): Promise<void> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) redirect("/register");

  // Unauthenticated email classifier — without a limit an attacker can
  // bulk-enumerate investor-contact emails via the path=contact vs path=fund
  // redirect. Throttle BEFORE the classification/lookup queries run so a
  // throttled caller never triggers them. Generic message only — never echo
  // the email back on this path.
  if (!(await checkRate("signup"))) {
    redirect("/register?error=rate-limited");
  }

  const cls = await classifyEmailForSignup(email);
  if (cls.kind === "blocked") {
    const errorSlug =
      cls.reason === "free-provider"
        ? "free-provider"
        : cls.reason === "greylisted"
          ? "greylisted"
          : "invalid-email";
    redirect(`/register?error=${errorSlug}`);
  }

  // Prefill the classified email on the next page via a short-lived,
  // httpOnly cookie rather than a URL param — a URL-borne email leaks into
  // logs/history/referer headers.
  await setRegEmailCookie(email);

  if (cls.kind === "internal") {
    redirect("/register?path=internal");
  }

  const contact = await prisma.person.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, investorId: { not: null } },
    select: { id: true },
  });
  redirect(contact ? "/register?path=contact" : "/register?path=fund");
}

async function setRegEmailCookie(email: string): Promise<void> {
  (await cookies()).set("reg_email", email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/register",
    maxAge: 600,
  });
}

/** Internal staff signup. */
export async function internalSignupAction(_prev: WizardActionState, formData: FormData): Promise<WizardActionState> {
  if (!(await checkRate("signup"))) return { error: "Too many attempts — try again later." };
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { error: "Passwords do not match." };

  let target: string;
  try {
    const res = await signupInternal({
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? "").trim(),
      jobTitle: String(formData.get("jobTitle") ?? "").trim() || undefined,
      password,
    });
    target = res.status === "active" ? "/login?notice=account-created" : "/register?step=pending";
  } catch (err) {
    if (err instanceof AuthFlowError) return { error: err.message };
    throw err;
  }
  redirect(target);
}

/** Existing investor-contact account request. */
export async function contactSignupAction(_prev: WizardActionState, formData: FormData): Promise<WizardActionState> {
  if (!(await checkRate("signup"))) return { error: "Too many attempts — try again later." };
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { error: "Passwords do not match." };

  try {
    await signupExistingContact({ email: String(formData.get("email") ?? ""), password });
  } catch (err) {
    if (err instanceof AuthFlowError) return { error: err.message };
    throw err;
  }
  redirect("/register?step=pending");
}

/** Client-serialized team rows; malformed JSON degrades to "no members". */
function safeParseMembers(json: string): unknown {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** New-fund wizard submit (replaces the old registerWizardAction). */
export async function registerWizardAction(_prev: WizardActionState, formData: FormData): Promise<WizardActionState> {
  if (!(await checkRate("signup"))) return { error: "Too many attempts — try again later." };
  const raw = {
    fundName: String(formData.get("fundName") ?? "").trim(),
    contactPerson: String(formData.get("contactPerson") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    investorType: String(formData.get("investorType") ?? "").trim(),
    sectorPreference: formData.getAll("sectorPreference").map(String),
    geographicFocus: formData.getAll("geographicFocus").map(String),
    dealTypes: formData.getAll("dealTypes").map(String),
    ticketMin: String(formData.get("ticketMin") ?? "").trim(),
    ticketMax: String(formData.get("ticketMax") ?? "").trim(),
    currency: String(formData.get("currency") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    members: safeParseMembers(String(formData.get("membersJson") ?? "[]")),
  };
  try {
    await registerInvestorWithAccount(raw);
  } catch (err) {
    if (err instanceof ZodError) return { error: err.issues[0]?.message ?? "Check the form and try again" };
    if (err instanceof RegistrationError) return { error: err.message };
    throw err;
  }
  redirect("/register?step=pending");
}
