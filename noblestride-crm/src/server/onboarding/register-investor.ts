// register-investor.ts — the testable core of public investor registration.
// Plain server module (no "use server"): the /register server actions are thin
// wrappers that parse FormData and delegate here (same split as
// portal/partner/refer/submit-referral.ts).
//
// Registration lands in PendingReview: a Noblestride team member must approve
// every investor before any deal visibility (anti-broker guardrail, SOW §06).

import type { Investor } from "@prisma/client";
import { prisma } from "@/lib/db";
import { registrationAccountSchema } from "@/lib/schemas/registration";
import { emailDomain } from "@/lib/corporate-email";
import { notify, adminUserIds } from "@/server/services/notifications";
import { hashPassword } from "@/server/auth/password";
import { unusablePasswordHash } from "@/server/auth/team-invites";
import { isUniqueViolation } from "@/server/auth/accounts";

export class RegistrationError extends Error {}

/**
 * True when the email's exact address or its domain has been blocked from
 * self-registration (populated when an investor is greylisted).
 */
export async function isRegistrationBlocked(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const domain = emailDomain(normalized);
  const hit = await prisma.blockedRegistration.findFirst({
    where: {
      OR: [
        { kind: "Email", value: normalized },
        ...(domain ? [{ kind: "Domain" as const, value: domain }] : []),
      ],
    },
    select: { id: true },
  });
  return hit !== null;
}

/**
 * Registers a new fund/investor: creates the Investor (PendingReview), its
 * primary-contact Person, an activity note, and a PENDING AuthAccount with a
 * hashed password — the contact can sign in once the team approves.
 */
export async function registerInvestorWithAccount(raw: unknown): Promise<Investor> {
  const input = registrationAccountSchema.parse(raw);
  const email = input.email.toLowerCase();

  if (await isRegistrationBlocked(input.email)) {
    throw new RegistrationError(
      "This email domain is not eligible to register. Contact Noblestride if you believe this is an error.",
    );
  }

  const existing = await prisma.person.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" }, investorId: { not: null } },
  });
  if (existing) {
    throw new RegistrationError("A registration with this contact email already exists. Contact Noblestride if you need access.");
  }

  const existingAccount = await prisma.authAccount.findUnique({ where: { email }, select: { id: true } });
  if (existingAccount) {
    throw new RegistrationError("A registration with this contact email already exists. Contact Noblestride if you need access.");
  }

  const [firstName, ...restName] = input.contactPerson.split(/\s+/);
  const passwordHash = await hashPassword(input.password);

  const memberInputs: { name: string; email: string; phone: string; passwordHash: string }[] = [];
  const skippedMembers: string[] = [];
  for (const m of input.members) {
    const memberEmail = m.email.toLowerCase();
    const [personHit, accountHit] = await Promise.all([
      prisma.person.findFirst({ where: { email: { equals: memberEmail, mode: "insensitive" } }, select: { id: true } }),
      prisma.authAccount.findUnique({ where: { email: memberEmail }, select: { id: true } }),
    ]);
    if (personHit || accountHit || (await isRegistrationBlocked(memberEmail))) {
      skippedMembers.push(memberEmail);
      continue;
    }
    memberInputs.push({ ...m, email: memberEmail, passwordHash: await unusablePasswordHash() });
  }

  let investor: Investor;
  try {
    investor = await prisma.$transaction(async (tx) => {
      const investor = await tx.investor.create({
      data: {
        name: input.fundName,
        investorType: input.investorType,
        sectorFocus: input.sectorPreference,
        geographicFocus: input.geographicFocus,
        instruments: input.dealTypes,
        ticketMin: input.ticketMin,
        ticketMax: input.ticketMax,
        currency: input.currency,
        onboardingStatus: "PendingReview",
        registeredAt: new Date(),
        createdSource: "API",
      },
    });
    const person = await tx.person.create({
      data: {
        firstName,
        lastName: restName.join(" ") || null,
        email: input.email,
        phone: input.phone,
        isPrimaryContact: true,
        investorId: investor.id,
      },
    });
    await tx.authAccount.create({
      data: {
        email,
        passwordHash,
        kind: "INVESTOR",
        status: "PENDING",
        personId: person.id,
      },
    });
    for (const m of memberInputs) {
      const [mFirst, ...mRest] = m.name.trim().split(/\s+/);
      const memberPerson = await tx.person.create({
        data: {
          firstName: mFirst ?? "Member",
          lastName: mRest.join(" ") || null,
          email: m.email,
          phone: m.phone || null,
          investorId: investor.id,
        },
      });
      await tx.authAccount.create({
        data: {
          email: m.email,
          passwordHash: m.passwordHash,
          kind: "INVESTOR",
          status: "PENDING",
          personId: memberPerson.id,
        },
      });
    }
    if (memberInputs.length > 0 || skippedMembers.length > 0) {
      const subject = memberInputs.length > 0
        ? `Team members added at registration: ${memberInputs.map((m) => m.email).join(", ")}`
        : "Team members added at registration: none";
      let body = "Seats are pending review; share links are generated from the portal Team page after approval.";
      if (skippedMembers.length > 0) {
        body += `\nSkipped (email unavailable): ${skippedMembers.join(", ")}`;
      }
      await tx.activity.create({
        data: {
          type: "Note",
          subject,
          body,
          investorId: investor.id,
          createdSource: "API",
        },
      });
    }
    await tx.activity.create({
      data: {
        type: "Note",
        subject: `Investor self-registered via portal: ${input.fundName}`,
        body: `Contact: ${input.contactPerson} <${input.email}>, ${input.phone}. Awaiting team review.`,
        investorId: investor.id,
        createdSource: "API",
      },
    });
    return investor;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new RegistrationError(
        "A registration with this contact email already exists. Contact Noblestride if you need access.",
      );
    }
    throw err;
  }

  // Best-effort, post-commit: alert every Admin that a registration is
  // awaiting review. External self-registration has no internal actor to
  // skip. The whole block is guarded because `adminUserIds()` runs OUTSIDE
  // `notify`'s own try/catch — a throw here (e.g. the admin query failing)
  // must never surface to the caller after the business transaction has
  // already committed.
  try {
    await notify(await adminUserIds(), {
      kind: "new_registration",
      title: `New investor registration: ${investor.name}`,
      href: "/investors?onboarding=PendingReview",
    });
  } catch (err) {
    console.error("registerInvestor: post-commit notification failed", err);
  }

  return investor;
}
