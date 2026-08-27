"use server";
// Partner-portal account management (F5.6), the partner mirror of
// investors/[id]/account-actions.ts. Every action re-checks the REAL admin role
// server-side (never the impersonation lens) and re-scopes the posted accountId
// to this partner — the form only sends accountId, and partnerId comes from the
// page, so without that check an admin on partner A's page could post partner
// B's accountId.

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireRealAdmin } from "@/server/auth/require-real-admin";
import { suspendAccount, reactivateAccount, AuthFlowError } from "@/server/auth/accounts";
import { issueStaffResetLink } from "@/server/auth/reset";
import { createPartnerInvite, resendPartnerInvite, PartnerInviteError } from "@/server/auth/partner-invites";
import { changeAccountEmailByStaff, EmailChangeError } from "@/server/auth/change-email";
import { prisma } from "@/lib/db";

export interface PartnerAccessState {
  error?: string;
  notice?: string;
  resetLink?: string;
  emailSent?: boolean;
  inviteUrl?: string;
}

async function requireAccountBelongsToPartner(accountId: string, partnerId: string) {
  const account = await prisma.authAccount.findUnique({
    where: { id: accountId },
    include: { person: true },
  });
  if (!account || account.kind !== "PARTNER" || account.person?.partnerId !== partnerId) {
    throw new Error("Not authorized");
  }
}

async function baseUrl(): Promise<string> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function run(
  partnerId: string,
  fn: (adminUserId: string, adminLabel: string) => Promise<PartnerAccessState | void>,
): Promise<PartnerAccessState> {
  try {
    const admin = await requireRealAdmin();
    const label = admin.user?.name ?? "Noblestride Capital";
    const result = await fn(admin.user!.id, label);
    revalidatePath(`/partners/${partnerId}`);
    return result ?? {};
  } catch (err) {
    if (err instanceof EmailChangeError) return { error: err.message };
    if (err instanceof PartnerInviteError) return { error: err.message };
    if (err instanceof AuthFlowError) return { error: err.message };
    if (err instanceof Error && err.message === "Not authorized") return { error: "Not authorized." };
    throw err;
  }
}

export async function invitePartnerContactAction(
  _p: PartnerAccessState,
  formData: FormData,
): Promise<PartnerAccessState> {
  const partnerId = String(formData.get("partnerId"));
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!name || !email) return { error: "Name and email are required." };
  return run(partnerId, async (_adminId, adminLabel) => {
    const issued = await createPartnerInvite({
      partnerId,
      name,
      email,
      phone: String(formData.get("phone") ?? "").trim() || undefined,
      jobTitle: String(formData.get("jobTitle") ?? "").trim() || undefined,
      invitedByLabel: adminLabel,
      baseUrl: await baseUrl(),
    });
    return {
      inviteUrl: `${await baseUrl()}/invite/${issued.rawToken}`,
      emailSent: issued.emailSent,
      notice: issued.emailSent
        ? `Invitation emailed to ${issued.email}.`
        : `Couldn't email ${issued.email} — send the link below yourself.`,
    };
  });
}

export async function resendPartnerInviteAction(
  _p: PartnerAccessState,
  formData: FormData,
): Promise<PartnerAccessState> {
  const partnerId = String(formData.get("partnerId"));
  const personId = String(formData.get("personId"));
  return run(partnerId, async (_adminId, adminLabel) => {
    const issued = await resendPartnerInvite(personId, partnerId, await baseUrl(), adminLabel);
    return {
      inviteUrl: `${await baseUrl()}/invite/${issued.rawToken}`,
      emailSent: issued.emailSent,
      notice: issued.emailSent
        ? `Invitation re-sent to ${issued.email}.`
        : `Couldn't email ${issued.email} — send the link below yourself.`,
    };
  });
}

export async function suspendPartnerAccountAction(
  _p: PartnerAccessState,
  formData: FormData,
): Promise<PartnerAccessState> {
  const partnerId = String(formData.get("partnerId"));
  const accountId = String(formData.get("accountId"));
  return run(partnerId, async (adminId) => {
    await requireAccountBelongsToPartner(accountId, partnerId);
    await suspendAccount(accountId, adminId);
  });
}

export async function reactivatePartnerAccountAction(
  _p: PartnerAccessState,
  formData: FormData,
): Promise<PartnerAccessState> {
  const partnerId = String(formData.get("partnerId"));
  const accountId = String(formData.get("accountId"));
  return run(partnerId, async (adminId) => {
    await requireAccountBelongsToPartner(accountId, partnerId);
    await reactivateAccount(accountId, adminId);
  });
}

export async function partnerResetLinkAction(
  _p: PartnerAccessState,
  formData: FormData,
): Promise<PartnerAccessState> {
  const partnerId = String(formData.get("partnerId"));
  const accountId = String(formData.get("accountId"));
  return run(partnerId, async () => {
    await requireAccountBelongsToPartner(accountId, partnerId);
    const { url, emailSent } = await issueStaffResetLink(accountId, await baseUrl());
    return { resetLink: url, emailSent };
  });
}

/** F3.6: move the sign-in email on a partner-portal account. */
export async function changePartnerAccountEmailAction(
  _p: PartnerAccessState,
  formData: FormData,
): Promise<PartnerAccessState> {
  const partnerId = String(formData.get("partnerId"));
  const accountId = String(formData.get("accountId"));
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter the new email address." };
  return run(partnerId, async (adminId) => {
    await requireAccountBelongsToPartner(accountId, partnerId);
    const res = await changeAccountEmailByStaff(accountId, email, {
      type: "HUMAN",
      authenticated: true,
      userId: adminId,
    });
    return {
      notice:
        `Sign-in email changed to ${res.newEmail}. Sessions were signed out` +
        `${res.noticeSent.new ? " and both addresses were notified." : "; we couldn't email the notices."}`,
    };
  });
}
