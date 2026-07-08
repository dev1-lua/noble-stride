// Investor 2FA: short-lived signed "pending" cookie carrying the interstitial
// state between password success and OTP entry, and a 30-day signed
// "trusted device" cookie that lets a known browser skip OTP. HS256 over
// AUTH_SECRET (same scheme as the impersonation lens). Plus the issue-OTP
// orchestration (create challenge -> dev sink -> email).
import { SignJWT, jwtVerify } from "jose";
import { createOtpChallenge } from "./otp";
import { recordDevOtp } from "./dev-otp-sink";
import { sendMail } from "./mailer";

export const PENDING_COOKIE = "ns_2fa_pending";
export const TRUST_COOKIE = "ns_2fa_trust";
export const PENDING_TTL_S = 10 * 60; // 10 minutes
export const TRUST_TTL_S = 30 * 24 * 60 * 60; // 30 days

export type PendingPayload = { accountId: string; challengeId: string; emailMask: string };

// Thrown by issueLoginOtp when sendMail fails (e.g. Resend outage/misconfig).
// The OTP challenge row is already created and will simply expire unused.
export class OtpDeliveryError extends Error {}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function signPending(p: PendingPayload): Promise<string> {
  return new SignJWT({ aid: p.accountId, cid: p.challengeId, mask: p.emailMask })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_TTL_S}s`)
    .sign(secret());
}

export async function verifyPending(jwt: string | undefined): Promise<PendingPayload | null> {
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret());
    if (typeof payload.aid !== "string" || typeof payload.cid !== "string" || typeof payload.mask !== "string") {
      return null;
    }
    return { accountId: payload.aid, challengeId: payload.cid, emailMask: payload.mask };
  } catch {
    return null;
  }
}

export async function signTrust(accountId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(accountId)
    .setIssuedAt()
    .setExpirationTime(`${TRUST_TTL_S}s`)
    .sign(secret());
}

export async function verifyTrust(jwt: string | undefined, accountId: string): Promise<boolean> {
  if (!jwt) return false;
  try {
    const { payload } = await jwtVerify(jwt, secret());
    return payload.sub === accountId;
  } catch {
    return false;
  }
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "****";
  const shown = user.slice(0, 1);
  return `${shown}${"*".repeat(Math.max(3, user.length - 1))}@${domain}`;
}

function renderOtpEmail(code: string): { subject: string; text: string } {
  return {
    subject: "Your NobleStride sign-in code",
    text: `Your NobleStride verification code is ${code}. It expires in 10 minutes. If you didn't try to sign in, you can ignore this email.`,
  };
}

export async function issueLoginOtp(account: { id: string; email: string }): Promise<{ challengeId: string; emailMask: string }> {
  const { challengeId, code } = await createOtpChallenge(account.id, account.email);
  recordDevOtp(account.email, code); // no-op unless dev + console fallback
  const { subject, text } = renderOtpEmail(code);
  try {
    await sendMail({ to: account.email, subject, text });
  } catch (err) {
    console.error("[2fa] OTP email send failed:", err);
    throw new OtpDeliveryError("otp delivery failed");
  }
  return { challengeId, emailMask: maskEmail(account.email) };
}
