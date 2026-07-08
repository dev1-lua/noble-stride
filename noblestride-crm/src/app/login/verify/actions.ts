"use server";
// Investor 2FA step. Authorized solely by the signed ns_2fa_pending cookie set
// by loginAction after a correct password. No session exists yet.

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logAuthEvent } from "@/server/auth/audit";
import { invalidateOtpChallenges, verifyOtpChallenge } from "@/server/auth/otp";
import { rateLimit } from "@/server/auth/rate-limit";
import { createSession } from "@/server/auth/session";
import { setSessionCookie } from "@/server/auth/session-cookie";
import {
  PENDING_COOKIE, PENDING_TTL_S, TRUST_COOKIE, TRUST_TTL_S,
  issueLoginOtp, signPending, signTrust, verifyPending,
} from "@/server/auth/two-factor";
import { safeNext } from "../safe-next";

const RESEND_COOLDOWN_MS = 60 * 1000;

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function verifyLoginOtpAction(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  const pending = await verifyPending(cookieStore.get(PENDING_COOKIE)?.value);
  const next = safeNext(String(formData.get("next") ?? "") || undefined);
  if (!pending) redirect("/login?error=session-expired");

  const ip = await clientIp();
  if (!rateLimit(`otp-verify:${ip}`) || !rateLimit(`otp-verify:${pending.accountId}`, { max: 20 })) {
    redirect("/login?error=locked");
  }

  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const trust = String(formData.get("trust") ?? "") === "on";
  const result = await verifyOtpChallenge(pending.challengeId, code);

  const backToVerify = (params: string) => redirect(`/login/verify?${params}${next ? `&next=${encodeURIComponent(next)}` : ""}`);

  if (result.status === "invalid") backToVerify(`error=invalid&remaining=${result.remaining}`);
  if (result.status === "expired") {
    cookieStore.delete(PENDING_COOKIE);
    redirect("/login?error=code-expired");
  }
  if (result.status === "locked") {
    cookieStore.delete(PENDING_COOKIE);
    await invalidateOtpChallenges(pending.accountId);
    redirect("/login?error=too-many-codes");
  }

  // status === "ok"
  if (result.status !== "ok" || result.accountId !== pending.accountId) {
    redirect("/login?error=session-expired");
  }

  const account = await prisma.authAccount.findUnique({
    where: { id: pending.accountId },
    include: { person: true },
  });
  if (!account) redirect("/login?error=session-expired");

  const h = await headers();
  const { token, expiresAt } = await createSession(account!.id, {
    ip, userAgent: h.get("user-agent") ?? undefined,
  });
  await prisma.authAccount.update({
    where: { id: account!.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await setSessionCookie(token, expiresAt);
  cookieStore.delete(PENDING_COOKIE);

  if (trust) {
    cookieStore.set(TRUST_COOKIE, await signTrust(account!.id), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: TRUST_TTL_S,
    });
  }

  if (account!.person?.investorId) {
    await prisma.investor.updateMany({
      where: { id: account!.person.investorId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  }
  await logAuthEvent(`Auth: 2FA login success — ${account!.email}`);
  redirect(next ?? (account!.kind === "INTERNAL" ? "/dashboard" : "/portal/investor"));
}

export async function resendLoginOtpAction(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  const pending = await verifyPending(cookieStore.get(PENDING_COOKIE)?.value);
  const next = safeNext(String(formData.get("next") ?? "") || undefined);
  if (!pending) redirect("/login?error=session-expired");

  const ip = await clientIp();
  if (!rateLimit(`otp-resend:${ip}`, { max: 5 }) || !rateLimit(`otp-resend:${pending.accountId}`, { max: 5 })) {
    redirect("/login?error=too-many-codes");
  }

  // 60s cooldown based on the most recent challenge for this account.
  const latest = await prisma.authOtpChallenge.findFirst({
    where: { accountId: pending.accountId, purpose: "LOGIN_2FA" },
    orderBy: { createdAt: "desc" },
  });
  const nextParam = next ? `&next=${encodeURIComponent(next)}` : "";
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    redirect(`/login/verify?error=cooldown${nextParam}`);
  }

  const account = await prisma.authAccount.findUnique({ where: { id: pending.accountId } });
  if (!account) redirect("/login?error=session-expired");

  const { challengeId, emailMask } = await issueLoginOtp({ id: account!.id, email: account!.email });
  cookieStore.set(PENDING_COOKIE, await signPending({ accountId: account!.id, challengeId, emailMask }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: PENDING_TTL_S,
  });
  redirect(`/login/verify?resent=1${nextParam}`);
}
