// Partner-portal invites (F5.6). Mirrors team-invites.ts, with three
// deliberate differences:
//
//  1. Partner seats are STAFF-created, not self-service, so the account is
//     created ACTIVE — there is no org-approval gate to wait for (partners have
//     no `Investor.onboardingStatus` equivalent).
//  2. Partners have no Editor/Viewer split: the partner portal is read-only
//     status tracking for the deals they referred.
//  3. The invite email points at the partner portal, not the investor one.
//
// Redemption itself is shared: peekInviteToken/redeemInvite in team-invites.ts
// branch on `account.kind`, so /invite/[token] serves both.
//
// AUDIT NOTE: the investor path writes a Person-linked Activity that shows on
// the investor page. `Activity` has no `partnerId` column and the partner detail
// page has no timeline to render one (it shows StageChange history only), so
// partner invites are audited through logAuthEvent alone. Surfacing partner
// history on the page would need `Activity.partnerId` plus a timeline section —
// out of scope for F5.6, which is about partners being able to log in at all.

import { prisma } from "@/lib/db";
import type { AccountStatus } from "@prisma/client";
import { PHONE_MESSAGE, PHONE_PATTERN } from "@/lib/schemas/phone";
import { normalizeEmail } from "./guardrails";
import { assertEmailInvitable, unusablePasswordHash, INVITE_TTL_MS, TeamInviteError } from "./team-invites";
import { createAuthToken } from "./tokens";
import { sendPartnerInviteEmail } from "./auth-mail";
import { logAuthEvent } from "./audit";
import { isUniqueViolation } from "./accounts";

export class PartnerInviteError extends Error {}

// Same non-enumerating message as the investor path: never reveal what an
// unavailable email is already attached to.
const GENERIC_TAKEN = "This email can't be invited. Check the address, or contact Noblestride.";

export type PartnerInviteIssued = {
  rawToken: string;
  emailSent: boolean;
  email: string;
};

export type PartnerAccountSummary = {
  accountId: string;
  email: string;
  contactName: string;
  status: AccountStatus;
  lastLoginAt: Date | null;
  personId: string;
};

/** Translate the shared invitability guard's errors into this module's type. */
async function assertInvitable(email: string, opts?: { excludePersonId?: string }): Promise<void> {
  try {
    await assertEmailInvitable(email, opts);
  } catch (err) {
    if (err instanceof TeamInviteError) throw new PartnerInviteError(err.message);
    throw err;
  }
}

async function issueLink(
  accountId: string,
  email: string,
  partnerName: string,
  invitedByLabel: string,
  baseUrl: string,
): Promise<PartnerInviteIssued> {
  const rawToken = await createAuthToken(accountId, "INVITE", INVITE_TTL_MS);
  const { sent } = await sendPartnerInviteEmail({
    to: email,
    inviteUrl: `${baseUrl}/invite/${rawToken}`,
    partnerName,
    invitedByLabel,
  });
  return { rawToken, emailSent: sent, email };
}

export async function createPartnerInvite(input: {
  partnerId: string;
  name: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  invitedByLabel: string;
  baseUrl: string;
}): Promise<{ personId: string } & PartnerInviteIssued> {
  if (input.phone && !PHONE_PATTERN.test(input.phone)) {
    throw new PartnerInviteError(PHONE_MESSAGE);
  }

  const email = normalizeEmail(input.email);
  await assertInvitable(email);

  const partner = await prisma.partner.findUniqueOrThrow({
    where: { id: input.partnerId },
    select: { name: true, status: true },
  });
  if (partner.status === "Inactive") {
    throw new PartnerInviteError("This partner is inactive — reactivate it before inviting contacts.");
  }

  const [firstName, ...restName] = input.name.trim().split(/\s+/);
  const passwordHash = await unusablePasswordHash();

  let created: { personId: string; accountId: string };
  try {
    created = await prisma.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: {
          firstName: firstName ?? "Contact",
          lastName: restName.join(" ") || null,
          email,
          phone: input.phone || null,
          jobTitle: input.jobTitle || null,
          partnerId: input.partnerId,
        },
      });
      const account = await tx.authAccount.create({
        data: {
          email,
          passwordHash,
          kind: "PARTNER",
          // Staff-created: no approval queue to pass through. The unusable
          // password hash is what keeps it unusable until redemption.
          status: "ACTIVE",
          personId: person.id,
        },
      });
      return { personId: person.id, accountId: account.id };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new PartnerInviteError(GENERIC_TAKEN);
    throw err;
  }

  const issued = await issueLink(
    created.accountId,
    email,
    partner.name,
    input.invitedByLabel,
    input.baseUrl,
  );
  await logAuthEvent(
    `Auth: partner invite created for ${email} (email ${issued.emailSent ? "sent" : "not sent"})`,
    `Partner ${partner.name} (${input.partnerId}); invited by ${input.invitedByLabel}. ` +
      "Read-only access to the deals this partner referred.",
  );
  return { personId: created.personId, ...issued };
}

/** Fresh link for an existing partner contact; outstanding INVITE links die. */
export async function resendPartnerInvite(
  personId: string,
  partnerId: string,
  baseUrl: string,
  invitedByLabel = "Noblestride Capital",
): Promise<PartnerInviteIssued> {
  const person = await prisma.person.findFirst({
    where: { id: personId, partnerId },
    include: { authAccount: true, partner: { select: { name: true, status: true } } },
  });
  if (!person) throw new PartnerInviteError("Contact not found.");
  if (person.partner?.status === "Inactive") {
    throw new PartnerInviteError("This partner is inactive — reactivate it before inviting contacts.");
  }
  if (person.authAccount?.lastLoginAt) {
    throw new PartnerInviteError("This contact has already signed in — use the reset link instead.");
  }
  if (person.authAccount?.status === "SUSPENDED") {
    throw new PartnerInviteError("This contact's access was suspended — reactivate it first.");
  }

  // No account yet: a staff-created partner contact being given portal access
  // for the first time.
  if (!person.authAccount) {
    if (!person.email) throw new PartnerInviteError("Add an email to this contact first.");
    const email = normalizeEmail(person.email);
    await assertInvitable(email, { excludePersonId: person.id });
    let account: { id: string };
    try {
      account = await prisma.authAccount.create({
        data: {
          email,
          passwordHash: await unusablePasswordHash(),
          kind: "PARTNER",
          status: "ACTIVE",
          personId: person.id,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new PartnerInviteError(GENERIC_TAKEN);
      throw err;
    }
    await logAuthEvent(
      `Auth: partner invite created for ${email}`,
      `Partner ${person.partner?.name ?? partnerId}; invited by ${invitedByLabel}.`,
    );
    return issueLink(account.id, email, person.partner?.name ?? "Noblestride", invitedByLabel, baseUrl);
  }

  await prisma.authToken.deleteMany({
    where: { accountId: person.authAccount.id, purpose: "INVITE", usedAt: null },
  });
  return issueLink(
    person.authAccount.id,
    person.authAccount.email,
    person.partner?.name ?? "Noblestride",
    invitedByLabel,
    baseUrl,
  );
}

/** Every partner contact that has a login account, for the staff access panel. */
export async function listPartnerAccounts(partnerId: string): Promise<PartnerAccountSummary[]> {
  const people = await prisma.person.findMany({
    where: { partnerId, authAccount: { isNot: null } },
    include: { authAccount: true },
    orderBy: { createdAt: "asc" },
  });
  return people.flatMap((person) => {
    const account = person.authAccount;
    if (!account) return [];
    return [{
      accountId: account.id,
      email: account.email,
      contactName: `${person.firstName} ${person.lastName ?? ""}`.trim(),
      status: account.status,
      lastLoginAt: account.lastLoginAt,
      personId: person.id,
    }];
  });
}

/** Partner contacts with no login yet — the "who can I invite?" list. */
export async function listInvitablePartnerContacts(
  partnerId: string,
): Promise<Array<{ personId: string; name: string; email: string | null }>> {
  const people = await prisma.person.findMany({
    where: { partnerId, authAccount: { is: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  return people.map((p) => ({
    personId: p.id,
    name: `${p.firstName} ${p.lastName ?? ""}`.trim(),
    email: p.email,
  }));
}
