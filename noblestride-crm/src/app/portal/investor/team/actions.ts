"use server";
// Team-management actions (spec 2026-07-19 §5.1). SECURITY: the investor id
// always comes from the session viewpoint; person ids are re-scoped to that
// investor inside the team-invites service — a client-supplied id can never
// reach another org. Raw invite links are returned once, to the inviter only.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getViewpoint } from "@/server/viewpoint";
import { getCurrentAuth } from "@/server/auth/current";
import {
  TeamInviteError,
  createTeamInvite,
  inviteExistingContact,
  removeTeamMember,
  revokeTeamInvite,
} from "@/server/auth/team-invites";

export interface TeamActionState {
  error?: string;
  inviteUrl?: string;
  invitedEmail?: string;
}

async function requireInvestor(): Promise<{ investorId: string; personId: string; label: string }> {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");
  const auth = await getCurrentAuth();
  const person = auth?.person;
  if (!person) redirect("/login");
  return {
    investorId: vp.recordId as string,
    personId: person.id,
    label: `${person.firstName} ${person.lastName ?? ""}`.trim(),
  };
}

async function inviteBaseUrl(): Promise<string> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/** Add a brand-new member and hand back their personal share link. */
export async function inviteTeamMemberAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const { investorId, label } = await requireInvestor();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!name || !email) return { error: "Name and email are required." };
  try {
    const { rawToken } = await createTeamInvite({
      investorId,
      name,
      email,
      phone: String(formData.get("phone") ?? "").trim() || undefined,
      jobTitle: String(formData.get("jobTitle") ?? "").trim() || undefined,
      invitedByLabel: label,
    });
    revalidatePath("/portal/investor/team");
    return { inviteUrl: `${await inviteBaseUrl()}/invite/${rawToken}`, invitedEmail: email.toLowerCase() };
  } catch (err) {
    if (err instanceof TeamInviteError) return { error: err.message };
    throw err;
  }
}

/** Copy-link / resend for an existing contact row (with or without a seat). */
export async function memberLinkAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const { investorId, label } = await requireInvestor();
  const personId = String(formData.get("personId") ?? "");
  if (!personId) return { error: "Contact not found." };
  try {
    const rawToken = await inviteExistingContact(personId, investorId, label);
    revalidatePath("/portal/investor/team");
    return { inviteUrl: `${await inviteBaseUrl()}/invite/${rawToken}` };
  } catch (err) {
    if (err instanceof TeamInviteError) return { error: err.message };
    throw err;
  }
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const { investorId } = await requireInvestor();
  const personId = String(formData.get("personId") ?? "");
  if (personId) await revokeTeamInvite(personId, investorId);
  revalidatePath("/portal/investor/team");
  redirect("/portal/investor/team");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const { investorId, personId: self } = await requireInvestor();
  const personId = String(formData.get("personId") ?? "");
  try {
    if (personId) await removeTeamMember(personId, investorId, self);
  } catch (err) {
    if (err instanceof TeamInviteError) redirect("/portal/investor/team?error=remove");
    throw err;
  }
  revalidatePath("/portal/investor/team");
  redirect("/portal/investor/team?removed=1");
}
