"use server";
// Server action for the dummy /login flow. Thin wrapper over the testable
// core in src/server/onboarding/resolve-login.ts. Errors round-trip via
// query params (same convention as /register).

import { redirect } from "next/navigation";
import { z } from "zod";
import { resolveLogin } from "@/server/onboarding/resolve-login";

const emailSchema = z.string().trim().email("Enter a valid email address.");

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Enter a valid email address.")}`);
  }
  const email = parsed.data;

  const res = await resolveLogin(email);
  if (res.kind === "unknown") {
    redirect(
      `/login?email=${encodeURIComponent(email)}&error=${encodeURIComponent(
        "No account found for this email.",
      )}`,
    );
  }
  if (res.kind === "admin") redirect("/api/viewpoint?role=admin");
  redirect(`/api/viewpoint?role=${res.kind}&recordId=${encodeURIComponent(res.recordId)}`);
}
