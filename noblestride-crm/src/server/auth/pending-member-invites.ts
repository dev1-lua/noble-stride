// Team invitations for members listed at registration (F3.5).
//
// At registration the org is PendingReview and its member accounts are created
// PENDING with an unusable password hash, so no invite link would work yet —
// members only get a link-free heads-up then. This module is the other half:
// once staff approve the organisation, every member who has never signed in
// gets a real INVITE link, emailed.
//
// Idempotent: a member with an unused INVITE token already outstanding is left
// alone, so re-approving an org does not spam it with fresh links.

import { prisma } from "@/lib/db";
import { INVITE_TTL_MS } from "./team-invites";
import { createAuthToken } from "./tokens";
import { sendInviteEmail } from "./auth-mail";

export async function sendPendingMemberInvites(
  investorId: string,
  baseUrl: string,
): Promise<{ invited: number; emailed: number }> {
  const investor = await prisma.investor.findUnique({
    where: { id: investorId },
    select: { name: true },
  });
  if (!investor) return { invited: 0, emailed: 0 };

  const people = await prisma.person.findMany({
    where: {
      investorId,
      // The primary contact set their own password during registration.
      isPrimaryContact: false,
      authAccount: { is: { lastLoginAt: null, status: "ACTIVE" } },
    },
    select: {
      id: true,
      authAccount: { select: { id: true, email: true } },
    },
  });

  const invitedEmails: string[] = [];
  let emailed = 0;
  for (const person of people) {
    const account = person.authAccount;
    if (!account) continue;
    const outstanding = await prisma.authToken.count({
      where: {
        accountId: account.id,
        purpose: "INVITE",
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (outstanding > 0) continue;
    const rawToken = await createAuthToken(account.id, "INVITE", INVITE_TTL_MS);
    const { sent } = await sendInviteEmail({
      to: account.email,
      inviteUrl: `${baseUrl}/invite/${rawToken}`,
      orgName: investor.name,
      invitedByLabel: "Noblestride Capital",
    });
    invitedEmails.push(account.email);
    if (sent) emailed += 1;
  }

  if (invitedEmails.length > 0) {
    await prisma.activity.create({
      data: {
        type: "Note",
        subject: "Team invitations emailed",
        body: `${invitedEmails.length} invitation(s) issued to: ${invitedEmails.join(", ")} (${emailed} emailed).`,
        investorId,
        createdSource: "API",
      },
    });
  }

  return { invited: invitedEmails.length, emailed };
}
