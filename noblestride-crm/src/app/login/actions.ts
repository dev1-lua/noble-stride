"use server";
// Real credential login (spec §10). The session cookie is set HERE in the
// action (not via a route-handler redirect — the client router drops that
// Set-Cookie). Errors round-trip via query params, same as before.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loginWithPassword } from "@/server/auth/login";
import { rateLimit } from "@/server/auth/rate-limit";
import { setSessionCookie } from "@/server/auth/session-cookie";

const emailSchema = z.string().trim().email("Enter a valid email address.");

const MESSAGES: Record<string, string> = {
  invalid: "Incorrect email or password.",
  locked: "Too many failed attempts. Try again in about 15 minutes.",
  pending: "Your account is awaiting review by the NobleStride team.",
  suspended: "This account is suspended. Contact NobleStride if you believe this is an error.",
};

function safeNext(next: string | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "") || undefined);
  const back = (error: string, email = "") =>
    redirect(
      `/login?error=${encodeURIComponent(error)}${email ? `&email=${encodeURIComponent(email)}` : ""}${next ? `&next=${encodeURIComponent(next)}` : ""}`,
    );

  if (!parsed.success) back(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
  const email = parsed.data!;

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`login:${ip}`)) back(MESSAGES.locked, email);

  const res = await loginWithPassword(email, password, { ip, userAgent: hdrs.get("user-agent") ?? undefined });
  if (!res.ok) back(MESSAGES[res.reason], email);
  const ok = res as Extract<Awaited<ReturnType<typeof loginWithPassword>>, { ok: true }>;

  await setSessionCookie(ok.token, ok.expiresAt);
  redirect(next ?? ok.home);
}
