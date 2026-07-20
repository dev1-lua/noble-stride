// Team-member invites (spec 2026-07-19): share-link provisioning for investor
// org members. No email delivery — createTeamInvite returns the raw link
// token exactly once and the inviter shares it out-of-band. The invited email
// is bound server-side (token → account → person.email), never in the URL,
// and verified at the /invite landing gate. Accounts are created with an
// unusable password hash so nothing can log in before redemption.

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { PHONE_MESSAGE, PHONE_PATTERN } from "@/lib/schemas/phone";
import { classifyEmailForSignup, normalizeEmail } from "./guardrails";
import { hashPassword } from "./password";
import { validatePassword } from "./policy";
import { hashToken, invalidateAllSessions } from "./session";
import { consumeAuthToken, createAuthToken } from "./tokens";
import { logAuthEvent } from "./audit";
import { isUniqueViolation } from "./accounts";

export class TeamInviteError extends Error {}

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// One message for every "email unavailable" case (taken anywhere, internal
// domain, greylisted) — never reveals what the email is attached to.
const GENERIC_TAKEN = "This email can't be invited. Check the address, or contact Noblestride.";

const BLOCKED_CLASSIFICATIONS = ["Greylisted", "Excluded"] as const;

/** A hash no password can verify against — pre-redemption accounts can't log in. */
export async function unusablePasswordHash(): Promise<string> {
  return hashPassword(randomBytes(32).toString("base64url"));
}

async function assertEmailInvitable(
  email: string,
  opts?: { excludePersonId?: string; investorId?: string },
): Promise<void> {
  const cls = await classifyEmailForSignup(email);
  if (cls.kind === "blocked" && cls.reason === "free-provider") {
    throw new TeamInviteError(
      "Please use their official company email — free providers (Gmail, Yahoo, …) are not accepted.",
    );
  }
  if (cls.kind !== "external") throw new TeamInviteError(GENERIC_TAKEN);
  const [personHit, accountHit] = await Promise.all([
    prisma.person.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        ...(opts?.excludePersonId ? { id: { not: opts.excludePersonId } } : {}),
      },
      select: { id: true, investorId: true },
    }),
    prisma.authAccount.findUnique({ where: { email }, select: { id: true } }),
  ]);
  // Own-team duplicate: not secret to the inviter — point them at resend.
  if (personHit && opts?.investorId && personHit.investorId === opts.investorId) {
    throw new TeamInviteError("This person is already on your team — use the link button next to their name instead.");
  }
  if (personHit || accountHit) throw new TeamInviteError(GENERIC_TAKEN);
}

export async function createTeamInvite(input: {
  investorId: string;
  name: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  invitedByLabel: string;
}): Promise<{ personId: string; rawToken: string }> {
  if (input.phone && !PHONE_PATTERN.test(input.phone)) {
    throw new TeamInviteError(PHONE_MESSAGE);
  }

  const email = normalizeEmail(input.email);
  await assertEmailInvitable(email, { investorId: input.investorId });

  const investor = await prisma.investor.findUniqueOrThrow({
    where: { id: input.investorId },
    select: { onboardingStatus: true, engagementClassification: true },
  });
  if ((BLOCKED_CLASSIFICATIONS as readonly string[]).includes(investor.engagementClassification)) {
    throw new TeamInviteError("Team invitations are not available for this account.");
  }

  const [firstName, ...restName] = input.name.trim().split(/\s+/);
  const passwordHash = await unusablePasswordHash();

  let created: { personId: string; accountId: string };
  try {
    created = await prisma.$transaction(async (tx) => {
    const person = await tx.person.create({
      data: {
        firstName: firstName ?? "Member",
        lastName: restName.join(" ") || null,
        email,
        phone: input.phone || null,
        jobTitle: input.jobTitle || null,
        investorId: input.investorId,
      },
    });
    const account = await tx.authAccount.create({
      data: {
        email,
        passwordHash,
        kind: "INVESTOR",
        status: investor.onboardingStatus === "Approved" ? "ACTIVE" : "PENDING",
        personId: person.id,
      },
    });
    await tx.activity.create({
      data: {
        type: "Note",
        subject: `Team member invited via portal: ${input.name.trim()} <${email}>`,
        body: `Invited by ${input.invitedByLabel}. Access is provisioned through a personal share link.`,
        investorId: input.investorId,
        createdSource: "API",
      },
    });
      return { personId: person.id, accountId: account.id };
    });
  } catch (err) {
    // Unique-constraint race (double submit / concurrent invite) collapses to
    // the same non-enumerating message as a pre-checked duplicate.
    if (isUniqueViolation(err)) throw new TeamInviteError(GENERIC_TAKEN);
    throw err;
  }

  const rawToken = await createAuthToken(created.accountId, "INVITE", INVITE_TTL_MS);
  await logAuthEvent(`Auth: team invite created for ${email}`, undefined, { investorId: input.investorId });
  return { personId: created.personId, rawToken };
}

/** Load a person, scoped to the investor — the caller's org boundary. */
async function memberOf(personId: string, investorId: string) {
  return prisma.person.findFirst({
    where: { id: personId, investorId },
    include: { authAccount: true },
  });
}

/** Fresh link for an existing member; outstanding INVITE links are invalidated. */
export async function resendTeamInvite(personId: string, investorId: string): Promise<string> {
  const person = await memberOf(personId, investorId);
  if (!person?.authAccount) throw new TeamInviteError("No invite exists for this contact.");
  if (person.authAccount.lastLoginAt) {
    throw new TeamInviteError("This member has already signed in — they can use password reset instead.");
  }
  // Removed/revoked seats are DELETED (see removeTeamMember/revokeTeamInvite) —
  // a SUSPENDED account here can only be a staff-suspended one; resend can't
  // reactivate that, it must go through an explicit re-invite.
  if (person.authAccount.status === "SUSPENDED") {
    throw new TeamInviteError("This member's access was removed — use Invite to re-add them.");
  }
  const investor = await prisma.investor.findUniqueOrThrow({
    where: { id: investorId }, select: { engagementClassification: true },
  });
  if ((BLOCKED_CLASSIFICATIONS as readonly string[]).includes(investor.engagementClassification)) {
    throw new TeamInviteError("Team invitations are not available for this account.");
  }
  await prisma.authToken.deleteMany({
    where: { accountId: person.authAccount.id, purpose: "INVITE", usedAt: null },
  });
  return createAuthToken(person.authAccount.id, "INVITE", INVITE_TTL_MS);
}

/** First link for a staff-created contact (Person without an account). */
export async function inviteExistingContact(
  personId: string,
  investorId: string,
  invitedByLabel: string,
): Promise<string> {
  const person = await memberOf(personId, investorId);
  if (!person) throw new TeamInviteError("Contact not found.");
  if (person.authAccount) return resendTeamInvite(personId, investorId);
  if (!person.email) throw new TeamInviteError("Add an email to this contact first — ask Noblestride to update it.");
  const email = normalizeEmail(person.email);
  // The Person itself owns this email — exclude self from the duplicate scan
  // so only OTHER owners (another org, a client, a partner, any account) block.
  await assertEmailInvitable(email, { excludePersonId: person.id });

  const investor = await prisma.investor.findUniqueOrThrow({
    where: { id: investorId },
    select: { onboardingStatus: true, engagementClassification: true },
  });
  if ((BLOCKED_CLASSIFICATIONS as readonly string[]).includes(investor.engagementClassification)) {
    throw new TeamInviteError("Team invitations are not available for this account.");
  }
  let account: { id: string };
  try {
    account = await prisma.authAccount.create({
      data: {
        email,
        passwordHash: await unusablePasswordHash(),
        kind: "INVESTOR",
        status: investor.onboardingStatus === "Approved" ? "ACTIVE" : "PENDING",
        personId: person.id,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new TeamInviteError(GENERIC_TAKEN);
    throw err;
  }
  await prisma.activity.create({
    data: {
      type: "Note",
      subject: `Team member invited via portal: ${person.firstName} <${email}>`,
      body: `Invited by ${invitedByLabel}. Access is provisioned through a personal share link.`,
      investorId,
      createdSource: "API",
    },
  });
  return createAuthToken(account.id, "INVITE", INVITE_TTL_MS);
}

/**
 * Kill outstanding links; a member who never signed in also loses the seat —
 * the account is DELETED (not suspended) so `activateAccountsForInvestor`'s
 * blanket PENDING+SUSPENDED→ACTIVE flip on org approval can't resurrect a
 * revoked seat. The Person stays; re-inviting later runs `inviteExistingContact`.
 */
export async function revokeTeamInvite(personId: string, investorId: string): Promise<void> {
  const person = await memberOf(personId, investorId);
  if (!person?.authAccount) return;
  await prisma.authToken.deleteMany({
    where: { accountId: person.authAccount.id, purpose: "INVITE", usedAt: null },
  });
  if (!person.authAccount.lastLoginAt) {
    await prisma.authAccount.delete({ where: { id: person.authAccount.id } });
  }
}

/**
 * Remove the member's access entirely; the Person stays as a CRM contact.
 * The account is DELETED (AuthSession/AuthToken cascade — see
 * prisma/schema.prisma) rather than suspended, for the same resurrection
 * reason as revokeTeamInvite: `activateAccountsForInvestor` blanket-flips
 * PENDING+SUSPENDED→ACTIVE on org approval. Explicit token/session cleanup
 * kept before the delete as belt-and-braces even though cascade covers it.
 */
export async function removeTeamMember(
  personId: string,
  investorId: string,
  currentPersonId: string,
): Promise<void> {
  if (personId === currentPersonId) throw new TeamInviteError("You can't remove your own access.");
  const person = await memberOf(personId, investorId);
  if (!person) throw new TeamInviteError("Contact not found.");
  if (person.authAccount) {
    await prisma.authToken.deleteMany({
      where: { accountId: person.authAccount.id, purpose: "INVITE", usedAt: null },
    });
    await invalidateAllSessions(person.authAccount.id);
    await prisma.authAccount.delete({ where: { id: person.authAccount.id } });
  }
  await prisma.activity.create({
    data: {
      type: "Note",
      subject: `Team member access removed: ${`${person.firstName} ${person.lastName ?? ""}`.trim()}`,
      investorId,
      createdSource: "API",
    },
  });
}

export type InvitePeek = {
  accountId: string;
  email: string;
  investorName: string;
  orgApproved: boolean;
};

/** Look at a link without consuming it. Null = invalid/expired/used/revoked. */
export async function peekInviteToken(raw: string): Promise<InvitePeek | null> {
  const row = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { account: { include: { person: { include: { investor: true } } } } },
  });
  if (!row || row.purpose !== "INVITE" || row.usedAt || row.expiresAt.getTime() <= Date.now()) return null;
  if (row.account.status === "SUSPENDED") return null; // revoked/removed
  const investor = row.account.person?.investor;
  if (!investor) return null;
  return {
    accountId: row.account.id,
    email: row.account.email,
    investorName: investor.name,
    orgApproved:
      investor.onboardingStatus === "Approved" &&
      !(BLOCKED_CLASSIFICATIONS as readonly string[]).includes(investor.engagementClassification),
  };
}

/**
 * The landing gate + set-password, in dependency order: link validity →
 * email match (server-bound) → org approval → password policy → consume-once
 * token → usable credentials. Error copy is user-safe and non-enumerating.
 */
export async function redeemInvite(
  raw: string,
  emailEntered: string,
  password: string,
): Promise<{ ok: true } | { ok: false; reason: "invalid" | "email" | "weak" | "pending"; error: string }> {
  const INVALID = {
    ok: false as const,
    reason: "invalid" as const,
    error: "This invite link is invalid or has expired. Ask your colleague to send a fresh one.",
  };
  const peek = await peekInviteToken(raw);
  if (!peek) return INVALID;
  if (normalizeEmail(emailEntered) !== peek.email) {
    return { ok: false, reason: "email", error: "No invitation found for this email." };
  }
  if (!peek.orgApproved) {
    return {
      ok: false,
      reason: "pending",
      error: "Your organization's registration is still under review. You'll be able to set up access once it's approved.",
    };
  }
  const policyError = validatePassword(password, peek.email);
  if (policyError) return { ok: false, reason: "weak", error: policyError };

  const account = await consumeAuthToken(raw, "INVITE");
  if (!account) return INVALID;

  await prisma.authAccount.update({
    where: { id: account.id },
    data: {
      passwordHash: await hashPassword(password),
      status: "ACTIVE",
      failedLogins: 0,
      lockedUntil: null,
    },
  });
  await logAuthEvent(`Auth: team invite redeemed for ${account.email}`);
  return { ok: true };
}
