"use server";
// Server actions for public application tracking (F2.4 / G1).
//
// Every branch of requestCodeAction ends on the SAME redirect. An anonymous
// caller must not be able to tell an unknown email from a known one, and a
// different notice, a different delay or a different status code would all say
// it. requestApplicantOtp is built the same way.

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  requestApplicantOtp,
  verifyApplicantOtp,
  APPLICANT_SESSION_COOKIE,
  APPLICANT_TOKEN_TTL_S,
  APPLICANT_OTP_MAX_PER_WINDOW,
  APPLICANT_OTP_WINDOW_MS,
} from "@/server/services/applicant-status";
import { rateLimit } from "@/server/auth/rate-limit";

async function callerIp(): Promise<string> {
  const hdrs = await headers();
  return hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function requestCodeAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const ip = await callerIp();
  // Per-IP cap on top of the per-email cap in the service: one address being
  // rate-limited must not be the signal that tells an attacker it exists.
  if (rateLimit(`applicant-otp-ip:${ip}`, {
    max: APPLICANT_OTP_MAX_PER_WINDOW * 3,
    windowMs: APPLICANT_OTP_WINDOW_MS,
  })) {
    if (email) await requestApplicantOtp(email);
  }
  redirect(`/apply/status?step=code&notice=code-sent&email=${encodeURIComponent(email)}`);
}

export async function verifyCodeAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const ip = await callerIp();
  if (!rateLimit(`applicant-verify-ip:${ip}`, { max: 20, windowMs: APPLICANT_OTP_WINDOW_MS })) {
    redirect("/apply/status?step=code&error=rate-limited");
  }

  const res = await verifyApplicantOtp(email, code);
  if (res.status !== "ok") {
    redirect(`/apply/status?step=code&error=code-invalid&email=${encodeURIComponent(email)}`);
  }

  const jar = await cookies();
  jar.set(APPLICANT_SESSION_COOKIE, res.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Scoped to this one page: the cookie grants nothing anywhere else.
    path: "/apply/status",
    maxAge: APPLICANT_TOKEN_TTL_S,
  });
  redirect("/apply/status");
}

export async function signOutApplicantAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(APPLICANT_SESSION_COOKIE);
  redirect("/apply/status?notice=signed-out");
}
