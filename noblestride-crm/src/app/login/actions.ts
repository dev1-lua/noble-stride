"use server";
// Real credential login (spec §10). The session cookie is set HERE in the
// action (not via a route-handler redirect — the client router drops that
// Set-Cookie). Failures return client state via useActionState (LoginForm) —
// nothing sensitive round-trips through the URL.

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loginWithPassword } from "@/server/auth/login";
import { rateLimit } from "@/server/auth/rate-limit";
import { setSessionCookie } from "@/server/auth/session-cookie";
import { PENDING_COOKIE, PENDING_TTL_S, TRUST_COOKIE } from "@/server/auth/two-factor";
import { safeNext } from "./safe-next";

const emailSchema = z.string().trim().email("Enter a valid email address.");

const MESSAGES: Record<string, string> = {
  invalid: "Incorrect email or password.",
  locked: "Too many failed attempts. Try again in about 15 minutes.",
  pending: "Your account is awaiting review by the NobleStride team.",
  suspended: "This account is suspended. Contact NobleStride if you believe this is an error.",
  otp_unavailable: "We couldn't send your verification code. Please try again in a moment.",
};

export interface LoginFormState {
  error?: string;
  email?: string;
}

export async function loginAction(_prev: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const rawEmail = String(formData.get("email") ?? "");
  const parsed = emailSchema.safeParse(rawEmail);
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "") || undefined);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address.", email: rawEmail };
  }
  const email = parsed.data;

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`login:${ip}`)) return { error: MESSAGES.locked, email };

  const cookieStore = await cookies();
  const trustedDeviceToken = cookieStore.get(TRUST_COOKIE)?.value;
  const res = await loginWithPassword(
    email,
    password,
    { ip, userAgent: hdrs.get("user-agent") ?? undefined },
    { trustedDeviceToken },
  );

  if (!res.ok && res.reason === "otp_required") {
    cookieStore.set(PENDING_COOKIE, res.pendingToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: PENDING_TTL_S,
    });
    redirect(`/login/verify${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  if (!res.ok) return { error: MESSAGES[res.reason] ?? "Sign-in failed.", email };

  const ok = res as Extract<Awaited<ReturnType<typeof loginWithPassword>>, { ok: true }>;
  await setSessionCookie(ok.token, ok.expiresAt);
  redirect(next ?? ok.home);
}
