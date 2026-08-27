// Credential login (real-auth spec §10). One generic "invalid" for wrong
// password AND unknown email (dummy-verify equalizes timing); account lockout
// after 10 straight failures for 15 minutes.

import { prisma } from "@/lib/db";
import { normalizeEmail } from "./guardrails";
import { DUMMY_HASH, verifyPassword } from "./password";
import { createSession } from "./session";
import { logAuthEvent } from "./audit";
import { twoFactorEnabled } from "./mailer";
import { OtpDeliveryError, issueLoginOtp, signPending, verifyTrust } from "./two-factor";
import { resolveViewpointFor, type CurrentAuth } from "./current";
import { viewpointHome } from "@/lib/viewpoint";

/**
 * Landing route for a freshly authenticated account (F5.6). Resolved through
 * the same `resolveViewpointFor` the rest of the app uses, rather than a
 * kind-based ternary — otherwise every new account kind (PARTNER here) silently
 * lands on the investor portal. `getCurrentAuth` can't be used: the session
 * cookie is not set yet at this point in the request.
 */
async function homeForAccount(account: CurrentAuth["account"]): Promise<string | null> {
  const [user, person] = await Promise.all([
    account.userId ? prisma.user.findUnique({ where: { id: account.userId } }) : null,
    account.personId
      ? prisma.person.findUnique({
          where: { id: account.personId },
          include: { investor: true, partner: true },
        })
      : null,
  ]);
  const vp = await resolveViewpointFor({ account, user, person });
  return vp ? viewpointHome(vp) : null;
}

const MAX_FAILURES = 10;
const LOCK_MS = 15 * 60 * 1000;

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date; home: string }
  | { ok: false; reason: "invalid" | "locked" | "pending" | "suspended" | "otp_unavailable" }
  | { ok: false; reason: "otp_required"; pendingToken: string; emailMask: string };

export async function loginWithPassword(
  emailRaw: string,
  password: string,
  meta?: { ip?: string; userAgent?: string },
  opts?: { trustedDeviceToken?: string },
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

  // Investor 2FA: password was correct, so clear the password-lockout counters,
  // but require an email OTP before issuing a session unless this device is trusted.
  // Gated by twoFactorEnabled() (Option B: RESEND_API_KEY is the switch) — when
  // no key is configured we can't deliver OTP emails, so skip straight to normal
  // session issuance (password-only) instead of blocking every investor login.
  if (account.kind === "INVESTOR" && twoFactorEnabled()) {
    const trusted = await verifyTrust(opts?.trustedDeviceToken, account.id);
    if (!trusted) {
      await prisma.authAccount.update({
        where: { id: account.id },
        data: { failedLogins: 0, lockedUntil: null },
      });
      try {
        const { challengeId, emailMask } = await issueLoginOtp({ id: account.id, email: account.email });
        const pendingToken = await signPending({ accountId: account.id, challengeId, emailMask });
        await logAuthEvent(`Auth: 2FA challenge issued — ${email}`);
        return { ok: false, reason: "otp_required", pendingToken, emailMask };
      } catch (err) {
        if (err instanceof OtpDeliveryError) return { ok: false, reason: "otp_unavailable" };
        throw err;
      }
    }
  }

  const { token, expiresAt } = await createSession(account.id, meta);
  await prisma.authAccount.update({
    where: { id: account.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await logAuthEvent(`Auth: login success — ${email}`);
  // An account whose viewpoint no longer resolves (deactivated User, orphaned
  // Person) is bounced back to /login rather than dropped on a page it cannot read.
  const home = (await homeForAccount(account)) ?? "/login";
  return { ok: true, token, expiresAt, home };
}
