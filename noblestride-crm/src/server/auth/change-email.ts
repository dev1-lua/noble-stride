// Email change (F3.6, screenshots image11/12: "when the email is changed it
// should also update the account record").
//
// Before this module, editing a contact wrote Person.email and nothing else, so
// the address the person actually signs in with — AuthAccount.email — went
// stale, and support had no way to fix it. Two paths, deliberately different:
//
//  * STAFF change (changeAccountEmailByStaff): immediate. An admin has already
//    established who they are talking to out of band, so there is nothing to
//    verify; the value of a confirmation step here would be zero and the cost
//    is a person locked out of their own account.
//  * SELF-SERVICE (requestEmailChangeSelfService → confirmEmailChange): the new
//    address must prove it receives mail before it becomes a login, or a typo
//    locks the person out permanently. AuthToken has no payload column, so the
//    address being moved to lives in AuthAccount.pendingEmail until confirmed —
//    that is the entire reason for that column.
//
// Both paths invalidate every session on the account: an email change is a
// credential change, and any session opened under the old identity should end.

import type { AccountKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Actor } from "@/graphql/context";
import { actorSource } from "@/server/services/crud";
import { recordStageChange } from "@/server/services/stage-history";
import { notify, adminUserIds } from "@/server/services/notifications";
import {
  INTERNAL_EMAIL_DOMAIN,
  classifyEmailForSignup,
  normalizeEmail,
  type SignupEmailClass,
} from "./guardrails";
import { createAuthToken, consumeAuthToken } from "./tokens";
import { invalidateAllSessions } from "./session";
import { appBaseUrl, sendVerifyEmailChange, sendEmailChangedNotice } from "./auth-mail";
import { logAuthEvent } from "./audit";

export class EmailChangeError extends Error {}

export const VERIFY_EMAIL_TTL_MS = 60 * 60 * 1000; // 60 minutes

/**
 * May this account kind hold this address? Pure — the caller passes the result
 * of `classifyEmailForSignup` so this stays testable without a database.
 *
 * The refusals never repeat the address back: this copy reaches a rendered page,
 * and echoing user input into it is how content-spoofing bugs start.
 */
export function emailPolicyFor(
  kind: AccountKind,
  email: string,
  cls: SignupEmailClass,
): { ok: true } | { ok: false; error: string } {
  if (cls.kind === "blocked") {
    if (cls.reason === "free-provider") {
      return {
        ok: false,
        error: "Please use an official company email — free providers (Gmail, Yahoo, …) are not accepted.",
      };
    }
    if (cls.reason === "greylisted") {
      return { ok: false, error: "That email is not eligible. Contact Noblestride if you believe this is an error." };
    }
    return { ok: false, error: "Enter a valid email address." };
  }

  if (kind === "INTERNAL") {
    return cls.kind === "internal"
      ? { ok: true }
      : { ok: false, error: `Noblestride team accounts must use an @${INTERNAL_EMAIL_DOMAIN} address.` };
  }

  // INVESTOR / PARTNER: an external account must never take an internal address,
  // or it would inherit the internal-domain trust classifyEmail grants.
  return cls.kind === "external"
    ? { ok: true }
    : { ok: false, error: `An external account can't use an @${INTERNAL_EMAIL_DOMAIN} address.` };
}

type AccountWithLinks = Prisma.AuthAccountGetPayload<{
  include: { person: { select: { id: true; investorId: true; clientId: true; partnerId: true } } };
}>;

async function loadAccount(accountId: string): Promise<AccountWithLinks> {
  const account = await prisma.authAccount.findUnique({
    where: { id: accountId },
    include: { person: { select: { id: true, investorId: true, clientId: true, partnerId: true } } },
  });
  if (!account) throw new EmailChangeError("Account not found.");
  return account;
}

/** Refuse an address any other account, or any other person, already owns. */
async function assertEmailFree(email: string, account: AccountWithLinks): Promise<void> {
  const [accountHit, personHit] = await Promise.all([
    prisma.authAccount.findUnique({ where: { email }, select: { id: true } }),
    prisma.person.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        ...(account.personId ? { id: { not: account.personId } } : {}),
      },
      select: { id: true },
    }),
  ]);
  if ((accountHit && accountHit.id !== account.id) || personHit) {
    throw new EmailChangeError("This email is already in use.");
  }
}

async function assertPolicy(email: string, account: AccountWithLinks): Promise<void> {
  const verdict = emailPolicyFor(account.kind, email, await classifyEmailForSignup(email));
  if (!verdict.ok) throw new EmailChangeError(verdict.error);
}

/** The record the audit trail hangs off, so the change is visible where the person lives. */
function auditTargets(account: AccountWithLinks) {
  return {
    investorId: account.person?.investorId ?? undefined,
    clientId: account.person?.clientId ?? undefined,
    partnerId: account.person?.partnerId ?? undefined,
  };
}

/**
 * Apply the change atomically: the login email, the contact record, the staff
 * User row when there is one, plus the audit rows. Shared by both paths.
 */
async function applyEmailChange(
  account: AccountWithLinks,
  newEmail: string,
  actor: Actor,
): Promise<void> {
  const oldEmail = account.email;
  const targets = auditTargets(account);
  await prisma.$transaction(async (tx) => {
    await tx.authAccount.update({
      where: { id: account.id },
      data: { email: newEmail, pendingEmail: null, pendingEmailRequestedAt: null },
    });
    if (account.personId) {
      await tx.person.update({ where: { id: account.personId }, data: { email: newEmail } });
    }
    if (account.userId) {
      await tx.user.update({ where: { id: account.userId }, data: { email: newEmail } });
    }
    // recordStageChange needs a target record; an INTERNAL account has none of
    // investor/client/partner, so those changes are captured by the Activity
    // below and by logAuthEvent instead.
    if (targets.investorId || targets.clientId || targets.partnerId) {
      await recordStageChange(tx, {
        field: "email",
        fromValue: oldEmail,
        toValue: newEmail,
        actor,
        ...targets,
      });
    }
    await tx.activity.create({
      data: {
        type: "Note",
        subject: `Sign-in email changed: ${oldEmail} → ${newEmail}`,
        investorId: targets.investorId,
        clientId: targets.clientId,
        createdSource: actorSource(actor),
      },
    });
  });
}

/**
 * Staff-initiated change, applied immediately. Returns both addresses and
 * whether each notice was delivered, so the UI can offer a fallback.
 */
export async function changeAccountEmailByStaff(
  accountId: string,
  newEmailRaw: string,
  actor: Actor,
): Promise<{ oldEmail: string; newEmail: string; noticeSent: { old: boolean; new: boolean } }> {
  const account = await loadAccount(accountId);
  const newEmail = normalizeEmail(newEmailRaw);
  if (!newEmail) throw new EmailChangeError("Enter a valid email address.");
  const oldEmail = account.email;
  if (newEmail === oldEmail) throw new EmailChangeError("That is already the sign-in email.");
  await assertPolicy(newEmail, account);
  await assertEmailFree(newEmail, account);

  await applyEmailChange(account, newEmail, actor);

  // Post-commit and best-effort: the change is done, and a failed notice must
  // not roll it back or surface as an error.
  await invalidateAllSessions(account.id);
  const [toOld, toNew] = await Promise.all([
    sendEmailChangedNotice({ to: oldEmail, newEmail }),
    sendEmailChangedNotice({ to: newEmail, newEmail }),
  ]);
  try {
    await notify(await adminUserIds(), {
      kind: "email_changed",
      title: `Sign-in email changed: ${oldEmail} → ${newEmail}`,
    });
  } catch (err) {
    console.error("[change-email] admin notification failed:", err);
  }
  await logAuthEvent(`Auth: sign-in email changed by staff — ${oldEmail} → ${newEmail}`);
  return { oldEmail, newEmail, noticeSent: { old: toOld.sent, new: toNew.sent } };
}

/**
 * Self-service request: park the address on the account and email the new one a
 * confirmation link. Nothing about the login changes until it is confirmed.
 */
export async function requestEmailChangeSelfService(
  accountId: string,
  newEmailRaw: string,
): Promise<{ pendingEmail: string; emailSent: boolean }> {
  const account = await loadAccount(accountId);
  const newEmail = normalizeEmail(newEmailRaw);
  if (!newEmail) throw new EmailChangeError("Enter a valid email address.");
  if (newEmail === account.email) throw new EmailChangeError("That is already your sign-in email.");
  await assertPolicy(newEmail, account);
  await assertEmailFree(newEmail, account);

  // One live request at a time: an older link must not still be redeemable
  // against a superseded pendingEmail.
  await prisma.authToken.deleteMany({
    where: { accountId: account.id, purpose: "VERIFY_EMAIL", usedAt: null },
  });
  await prisma.authAccount.update({
    where: { id: account.id },
    data: { pendingEmail: newEmail, pendingEmailRequestedAt: new Date() },
  });
  const raw = await createAuthToken(account.id, "VERIFY_EMAIL", VERIFY_EMAIL_TTL_MS);
  const { sent } = await sendVerifyEmailChange({
    to: newEmail,
    verifyUrl: `${appBaseUrl()}/verify-email/${raw}`,
    currentEmail: account.email,
  });
  await logAuthEvent(
    `Auth: email change requested — ${account.email} → ${newEmail} (email ${sent ? "sent" : "not sent"})`,
  );
  return { pendingEmail: newEmail, emailSent: sent };
}

const CONFIRM_INVALID = "This confirmation link is no longer valid. Request the change again.";

/** Redeem a VERIFY_EMAIL link and move the account onto its pending address. */
export async function confirmEmailChange(
  rawToken: string,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const consumed = await consumeAuthToken(rawToken, "VERIFY_EMAIL");
  if (!consumed) return { ok: false, error: CONFIRM_INVALID };

  const account = await loadAccount(consumed.id);
  const pending = account.pendingEmail;
  if (!pending) return { ok: false, error: CONFIRM_INVALID };
  const oldEmail = account.email;

  // Someone may have claimed the address between request and confirmation.
  try {
    await assertPolicy(pending, account);
    await assertEmailFree(pending, account);
  } catch (err) {
    // Clear the stale request so the person can start again cleanly.
    await prisma.authAccount.update({
      where: { id: account.id },
      data: { pendingEmail: null, pendingEmailRequestedAt: null },
    });
    return { ok: false, error: err instanceof EmailChangeError ? err.message : CONFIRM_INVALID };
  }

  await applyEmailChange(account, pending, { type: "HUMAN", authenticated: true } as Actor);
  await invalidateAllSessions(account.id);
  await sendEmailChangedNotice({ to: oldEmail, newEmail: pending });
  await logAuthEvent(`Auth: email change confirmed — ${oldEmail} → ${pending}`);
  return { ok: true, email: pending };
}
