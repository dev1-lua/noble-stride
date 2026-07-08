// Credential login (real-auth spec §10). One generic "invalid" for wrong
// password AND unknown email (dummy-verify equalizes timing); account lockout
// after 10 straight failures for 15 minutes.

import { prisma } from "@/lib/db";
import { normalizeEmail } from "./guardrails";
import { DUMMY_HASH, verifyPassword } from "./password";
import { createSession } from "./session";
import { logAuthEvent } from "./audit";

const MAX_FAILURES = 10;
const LOCK_MS = 15 * 60 * 1000;

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date; home: string }
  | { ok: false; reason: "invalid" | "locked" | "pending" | "suspended" };

export async function loginWithPassword(
  emailRaw: string,
  password: string,
  meta?: { ip?: string; userAgent?: string },
): Promise<LoginResult> {
  const email = normalizeEmail(emailRaw);
  const account = await prisma.authAccount.findUnique({ where: { email } });

  if (!account) {
    await verifyPassword(DUMMY_HASH, password); // timing equalization
    return { ok: false, reason: "invalid" };
  }
  if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
    return { ok: false, reason: "locked" };
  }

  const valid = await verifyPassword(account.passwordHash, password);
  if (!valid) {
    const failures = account.failedLogins + 1;
    await prisma.authAccount.update({
      where: { id: account.id },
      data: {
        failedLogins: failures,
        lockedUntil: failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : null,
      },
    });
    if (failures === MAX_FAILURES) {
      await logAuthEvent(`Auth: account locked after ${MAX_FAILURES} failed logins — ${email}`);
    }
    return { ok: false, reason: "invalid" };
  }

  if (account.status === "PENDING") return { ok: false, reason: "pending" };
  if (account.status === "SUSPENDED") return { ok: false, reason: "suspended" };

  const { token, expiresAt } = await createSession(account.id, meta);
  await prisma.authAccount.update({
    where: { id: account.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await logAuthEvent(`Auth: login success — ${email}`);
  return { ok: true, token, expiresAt, home: account.kind === "INTERNAL" ? "/dashboard" : "/portal/investor" };
}
