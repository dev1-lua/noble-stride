// Auth/onboarding mail wrappers (Aug-2026 feedback F3.5/F3.6/F2.4).
//
// `sendMail` throws when Resend rejects a message, which is the right behaviour
// for a transport but the wrong behaviour for an invite: a person's invitation
// must still be created, and the caller must still be able to hand over a
// copy-this-link fallback, when the mail provider is down or unconfigured.
// So every helper here returns `{ sent }` and NEVER throws. Callers surface a
// "copy link" fallback whenever `sent === false`.
//
// Plain text only, absolute URLs, no HTML: these messages go to people whose
// mail clients we know nothing about, and the links must survive copy/paste.

import { sendMail, type MailMessage } from "./mailer";

export type MailResult = { sent: boolean };

export interface AuthMailDeps {
  /** Injected in tests; defaults to the real transport. */
  send?: (m: MailMessage) => Promise<void>;
}

export function appBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}

const SIGNATURE = "\n\n— Noblestride Capital";

async function deliver(name: string, msg: MailMessage, deps?: AuthMailDeps): Promise<MailResult> {
  try {
    await (deps?.send ?? sendMail)(msg);
    return { sent: true };
  } catch (err) {
    // Never let a mail failure roll back the invite/token that was already
    // written; the caller shows the link instead.
    console.error(`[auth-mail] ${name} failed:`, err);
    return { sent: false };
  }
}

export async function sendInviteEmail(
  o: { to: string; inviteUrl: string; orgName: string; invitedByLabel: string },
  deps?: AuthMailDeps,
): Promise<MailResult> {
  return deliver("sendInviteEmail", {
    to: o.to,
    subject: `You've been invited to the Noblestride investor portal — ${o.orgName}`,
    text:
      `${o.invitedByLabel} has invited you to the Noblestride investor portal for ${o.orgName}.\n\n` +
      `Accept the invitation:\n${o.inviteUrl}\n\n` +
      `The link expires in 7 days. You'll set your own password.` +
      SIGNATURE,
  }, deps);
}

export async function sendPartnerInviteEmail(
  o: { to: string; inviteUrl: string; partnerName: string; invitedByLabel: string },
  deps?: AuthMailDeps,
): Promise<MailResult> {
  return deliver("sendPartnerInviteEmail", {
    to: o.to,
    subject: `You've been invited to the Noblestride partner portal — ${o.partnerName}`,
    text:
      `${o.invitedByLabel} has invited you to the Noblestride partner portal for ${o.partnerName}.\n\n` +
      `Accept the invitation:\n${o.inviteUrl}\n\n` +
      `The link expires in 7 days. You'll set your own password. From the portal you can ` +
      `follow the status of the deals you referred.` +
      SIGNATURE,
  }, deps);
}

export async function sendResetEmail(
  o: { to: string; resetUrl: string },
  deps?: AuthMailDeps,
): Promise<MailResult> {
  return deliver("sendResetEmail", {
    to: o.to,
    subject: "Reset your Noblestride password",
    text:
      `A password reset was requested for your Noblestride account.\n\n` +
      `Reset link (valid 60 minutes):\n${o.resetUrl}\n\n` +
      `If you did not request this, you can ignore this email — your password is unchanged.` +
      SIGNATURE,
  }, deps);
}

export async function sendVerifyEmailChange(
  o: { to: string; verifyUrl: string; currentEmail: string },
  deps?: AuthMailDeps,
): Promise<MailResult> {
  return deliver("sendVerifyEmailChange", {
    to: o.to,
    subject: "Confirm your new Noblestride email address",
    text:
      `You asked to change the sign-in email on the Noblestride account ${o.currentEmail} ` +
      `to this address.\n\n` +
      `Confirm the change (valid 60 minutes):\n${o.verifyUrl}\n\n` +
      `Until you confirm, keep signing in with ${o.currentEmail}. If you did not request ` +
      `this, ignore this email.` +
      SIGNATURE,
  }, deps);
}

export async function sendEmailChangedNotice(
  o: { to: string; newEmail: string },
  deps?: AuthMailDeps,
): Promise<MailResult> {
  return deliver("sendEmailChangedNotice", {
    to: o.to,
    subject: "Your Noblestride sign-in email was changed",
    text:
      `The sign-in email for your Noblestride account was changed to ${o.newEmail}. ` +
      `Any active sessions have been signed out.\n\n` +
      `If you did not expect this, contact Noblestride Capital immediately.` +
      SIGNATURE,
  }, deps);
}

export async function sendApplicantOtpEmail(
  o: { to: string; code: string },
  deps?: AuthMailDeps,
): Promise<MailResult> {
  // The code never goes in the subject line: subjects show up in notification
  // previews on lock screens and in mail-list views.
  return deliver("sendApplicantOtpEmail", {
    to: o.to,
    subject: "Your Noblestride verification code",
    text:
      `Your Noblestride verification code is ${o.code}. It expires in 10 minutes.\n\n` +
      `If you did not request this, ignore this email.` +
      SIGNATURE,
  }, deps);
}
