// register-investor.ts — the testable core of public investor registration.
// Plain server module (no "use server"): the /register server actions are thin
// wrappers that parse FormData and delegate here (same split as
// portal/partner/refer/submit-referral.ts).
//
// Registration lands in PendingReview: a NobleStride team member must approve
// every investor before any deal visibility (anti-broker guardrail, SOW §06).

import type { Investor } from "@prisma/client";
import { prisma } from "@/lib/db";
import { registrationSchema } from "@/lib/schemas/registration";
import { ticketBand } from "@/lib/ticket-bands";

/** DEMO ONLY — static OTP; no email/SMS is sent (see repo:memory/remaining-tasks.md). */
export const DEMO_OTP = "000000";

export class RegistrationError extends Error {}

export async function registerInvestor(raw: unknown): Promise<Investor> {
  const input = registrationSchema.parse(raw);

  const existing = await prisma.person.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" }, investorId: { not: null } },
  });
  if (existing) {
    throw new RegistrationError("A registration with this contact email already exists. Contact NobleStride if you need access.");
  }

  const band = ticketBand(input.dealSizeBand);
  const [firstName, ...restName] = input.contactPerson.split(/\s+/);

  return prisma.$transaction(async (tx) => {
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
    await tx.person.create({
      data: {
        firstName,
        lastName: restName.join(" ") || null,
        email: input.email,
        phone: input.phone,
        isPrimaryContact: true,
        investorId: investor.id,
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
}

/**
 * DEMO 2FA: both codes must equal DEMO_OTP; stamps email/phone verification.
 * Only meaningful while the registration is PendingReview.
 */
export async function confirmRegistrationOtp(investorId: string, emailCode: string, phoneCode: string): Promise<void> {
  if (emailCode.trim() !== DEMO_OTP || phoneCode.trim() !== DEMO_OTP) {
    throw new RegistrationError("Invalid verification code.");
  }
  const now = new Date();
  await prisma.investor.update({
    where: { id: investorId },
    data: { emailVerifiedAt: now, phoneVerifiedAt: now },
  });
}
