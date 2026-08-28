// Password reset (spec §10). requestPasswordReset never reveals whether the
// email exists. performPasswordReset policy-checks BEFORE consuming the token
// so a typo doesn't burn the link.

import { prisma } from "@/lib/db";
import { normalizeEmail } from "./guardrails";
import { hashPassword } from "./password";
import { validatePassword } from "./policy";
import { hashToken, invalidateAllSessions } from "./session";
import { createAuthToken, consumeAuthToken } from "./tokens";
import { sendResetEmail } from "./auth-mail";
import { sendMail } from "./mailer";
import { logAuthEvent } from "./audit";
import { AuthFlowError } from "./accounts";

export async function requestPasswordReset(emailRaw: string, baseUrl: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  const account = await prisma.authAccount.findUnique({ where: { email } });
  if (!account || account.status !== "ACTIVE") return; // silent — no enumeration
  const raw = await createAuthToken(account.id, "RESET_PASSWORD");
  try {
    await sendMail({
      to: email,
      subject: "Reset your Noblestride password",
      text: `Reset link (valid 60 minutes): ${baseUrl}/reset-password/${raw}`,
    });
  } catch (err) {
    // Preserve the no-enumeration contract: a send failure must not change
    // the (silent-success) response, so we log and return normally.
    console.error("[reset] password reset email send failed:", err);
    return;
  }
  await logAuthEvent(`Auth: password reset requested for ${email}`);
}

/**
 * Staff-initiated reset link (F3.5: "does the reset link email the member?").
 * Unlike `requestPasswordReset` this one is called by an authenticated admin
 * about a named account, so there is no enumeration concern: an unknown id is
 * an error, and the link is returned so the admin can pass it on when mail
 * could not be delivered.
 */
export async function issueStaffResetLink(
  accountId: string,
  baseUrl: string,
): Promise<{ url: string; emailSent: boolean; email: string }> {
  const account = await prisma.authAccount.findUnique({
    where: { id: accountId },
    select: { id: true, email: true },
  });
  if (!account) throw new AuthFlowError("Account not found.");
  const raw = await createAuthToken(account.id, "RESET_PASSWORD");
  const url = `${baseUrl}/reset-password/${raw}`;
  const { sent } = await sendResetEmail({ to: account.email, resetUrl: url });
  await logAuthEvent(
    `Auth: staff-issued reset link for ${account.email} (email ${sent ? "sent" : "not sent"})`,
  );
  return { url, emailSent: sent, email: account.email };
}

export async function performPasswordReset(
  rawToken: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; reason: "invalid" | "weak"; error: string }> {
  // Peek at the token to policy-check against the right email WITHOUT consuming.
  const peek = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { account: true },
  });
  if (!peek || peek.purpose !== "RESET_PASSWORD" || peek.usedAt || peek.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "invalid", error: "This reset link is invalid or has expired. Request a new one." };
  }
  const policyError = validatePassword(newPassword, peek.account.email);
  if (policyError) return { ok: false, reason: "weak", error: policyError };

  const account = await consumeAuthToken(rawToken, "RESET_PASSWORD");
  if (!account) {
    return { ok: false, reason: "invalid", error: "This reset link is invalid or has expired. Request a new one." };
  }

  await prisma.authAccount.update({
    where: { id: account.id },
    data: { passwordHash: await hashPassword(newPassword), failedLogins: 0, lockedUntil: null },
  });
  await invalidateAllSessions(account.id);
  await logAuthEvent(`Auth: password reset completed for ${account.email}`);
  return { ok: true };
}
