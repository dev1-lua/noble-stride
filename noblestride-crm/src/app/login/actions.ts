"use server";
// Server action for the dummy /login flow. Thin wrapper over the testable
// core in src/server/onboarding/resolve-login.ts. Errors round-trip via
// query params (same convention as /register).
//
// The viewpoint cookie is set HERE, not via a redirect through /api/viewpoint:
// the client router follows a server-action redirect with fetch and drops
// Set-Cookie from the route handler, leaving the browser signed out (and the
// default-admin viewpoint then lands investors on /dashboard).

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serializeViewpoint, viewpointHome, VIEWPOINT_COOKIE, type Viewpoint } from "@/lib/viewpoint";
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

  const vp: Viewpoint = res.kind === "admin" ? { role: "admin" } : { role: res.kind, recordId: res.recordId };
  (await cookies()).set(VIEWPOINT_COOKIE, serializeViewpoint(vp), { path: "/", sameSite: "lax" });
  redirect(viewpointHome(vp));
}
