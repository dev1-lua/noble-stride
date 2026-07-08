// register-investor.ts — the testable core of public investor registration.
// Plain server module (no "use server"): the /register server actions are thin
// wrappers that parse FormData and delegate here (same split as
// portal/partner/refer/submit-referral.ts).
//
// Registration lands in PendingReview: a NobleStride team member must approve
// every investor before any deal visibility (anti-broker guardrail, SOW §06).

import type { Investor } from "@prisma/client";
import { prisma } from "@/lib/db";
import { registrationAccountSchema } from "@/lib/schemas/registration";
import { ticketBand } from "@/lib/ticket-bands";
import { emailDomain } from "@/lib/corporate-email";
import { notify, adminUserIds } from "@/server/services/notifications";
import { hashPassword } from "@/server/auth/password";

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
      "This email domain is not eligible to register. Contact NobleStride if you believe this is an error.",
    );
  }

  const existing = await prisma.person.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" }, investorId: { not: null } },
  });
  if (existing) {
    throw new RegistrationError("A registration with this contact email already exists. Contact NobleStride if you need access.");
  }

  const existingAccount = await prisma.authAccount.findUnique({ where: { email }, select: { id: true } });
  if (existingAccount) {
    throw new RegistrationError("A registration with this contact email already exists. Contact NobleStride if you need access.");
  }

  const band = ticketBand(input.dealSizeBand);
  const [firstName, ...restName] = input.contactPerson.split(/\s+/);
  const passwordHash = await hashPassword(input.password);

  const investor = await prisma.$transaction(async (tx) => {
    const investor = await tx.investor.create({
      data: {
        name: input.fundName,
        investorType: input.investorType,
        sectorFocus: input.sectorPreference,
        instruments: [input.dealType],
        ticketMin: band?.min,
        ticketMax: band?.max ?? undefined,
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
