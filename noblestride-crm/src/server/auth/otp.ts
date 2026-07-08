// Email/phone-agnostic OTP core for 2FA. Short numeric codes, hashed at rest
// (same sha256 discipline as sessions/tokens), single-use, attempt-limited.
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashToken } from "./session";

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;

export type VerifyOtpResult =
  | { status: "ok"; accountId: string }
  | { status: "invalid"; remaining: number }
  | { status: "expired" }
  | { status: "locked" };

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtpCode(code: string): string {
  return hashToken(code);
}

export async function invalidateOtpChallenges(accountId: string): Promise<void> {
  await prisma.authOtpChallenge.updateMany({
    where: { accountId, purpose: "LOGIN_2FA", consumedAt: null },
    data: { consumedAt: new Date() },
  });
}

export async function createOtpChallenge(
  accountId: string,
  destination: string,
): Promise<{ challengeId: string; code: string }> {
  await invalidateOtpChallenges(accountId); // one active challenge per account
  const code = generateOtpCode();
  const row = await prisma.authOtpChallenge.create({
    data: {
      accountId,
      purpose: "LOGIN_2FA",
      codeHash: hashOtpCode(code),
      destination,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  return { challengeId: row.id, code };
}

export async function verifyOtpChallenge(challengeId: string, code: string): Promise<VerifyOtpResult> {
  const row = await prisma.authOtpChallenge.findUnique({ where: { id: challengeId } });
  if (!row) return { status: "invalid", remaining: 0 };
  if (row.consumedAt) return { status: "expired" };
  if (row.expiresAt.getTime() <= Date.now()) return { status: "expired" };
  if (row.attempts >= row.maxAttempts) return { status: "locked" };

  if (row.codeHash !== hashOtpCode(code)) {
    const updated = await prisma.authOtpChallenge.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true, maxAttempts: true },
    });
    const remaining = Math.max(0, updated.maxAttempts - updated.attempts);
    return remaining <= 0 ? { status: "locked" } : { status: "invalid", remaining };
  }

  // Correct code — claim single-use atomically.
  const claimed = await prisma.authOtpChallenge.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (claimed.count === 0) return { status: "expired" };
  return { status: "ok", accountId: row.accountId };
}
