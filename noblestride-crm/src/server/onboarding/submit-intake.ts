// submit-intake.ts — the testable core of the public client-intake wizard
// (/intake). Plain server module (no "use server"): the /intake server
// action is a thin wrapper that parses FormData and delegates here (same
// split as src/server/onboarding/register-investor.ts).
//
// A submission never auto-becomes an active deal: it lands as a Mandate in
// NewLead with a qualification verdict attached, and a human must assign a
// deal lead before it moves (design spec §04.3.8). The applicant never sees
// the verdict — the confirmation screen is always neutral.

import type { Mandate } from "@prisma/client";
import { prisma } from "@/lib/db";
import { intakeSubmitSchema } from "@/lib/schemas/intake";
import { qualifyIntake, type IntakeQualInput } from "@/server/domain/qualification";
import { notify, adminUserIds } from "@/server/services/notifications";

export async function submitIntake(raw: unknown): Promise<Mandate> {
  const input = intakeSubmitSchema.parse(raw);

  const qualInput: IntakeQualInput = {
    revenueUsd: input.revenueUsd,
    raiseUsd: input.raiseUsd,
    auditedYears: Number(input.auditedYears),
    countries: [input.country],
    sectors: input.sectors,
    pepExposure: input.pepExposure === "yes",
    governmentOwned: input.governmentOwned === "yes",
    ebitdaUsd: input.ebitdaUsd,
    yearFounded: input.yearFounded,
    currentYear: new Date().getFullYear(),
  };
  const { verdict, reasons } = qualifyIntake(qualInput);

  const mandate = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        name: input.legalName,
        registrationNo: input.registrationNo,
        hqCountry: input.country,
        countries: [input.country],
        sector: input.sectors,
        yearFounded: input.yearFounded,
        website: input.website || undefined,
        pitchDeckUrl: input.pitchDeckUrl || undefined,
        revenueLastYear: input.revenueUsd,
        ebitda: input.ebitdaUsd,
        netProfit: input.netProfitUsd,
        totalAssets: input.totalAssetsUsd,
        loanBook: input.loanBookUsd ?? undefined,
        existingDebt: input.existingDebtUsd ?? undefined,
        ownershipStructure: input.ownershipSummary,
        pepExposure: input.pepExposure === "yes",
        governmentOwned: input.governmentOwned === "yes",
        auditedFinancialsYears: Number(input.auditedYears),
        status: "Prospect",
        source: "Website",
        createdSource: "API",
        contacts: {
          create: {
            firstName: input.contactName,
            jobTitle: input.role,
            email: input.email,
            phone: input.phone,
            isPrimaryContact: true,
          },
        },
      },
    });

    const mandate = await tx.mandate.create({
      data: {
        name: `${input.legalName} — Fundraising`,
        stage: "NewLead",
        source: "Website",
        dealSize: input.raiseUsd,
        sector: input.sectors,
        notes: `Use of funds: ${input.useOfFunds}\nTimeline: ${input.proposedTimeline}`,
        clientId: client.id,
        createdSource: "API",
        qualificationVerdict: verdict,
        qualificationReasons: reasons,
        qualifiedAt: new Date(),
      },
    });

    await tx.activity.create({
      data: {
        type: "Note",
        subject: "Website intake received",
        channel: "WebChat",
        direction: "Inbound",
        clientId: client.id,
        mandateId: mandate.id,
      },
    });

    return mandate;
  });

  // Best-effort, post-commit: alert every Admin that a website application
  // is awaiting triage. Public intake has no internal actor to skip. The
  // whole block is guarded because `adminUserIds()` runs OUTSIDE `notify`'s
  // own try/catch — a throw here must never surface to the caller after the
  // business transaction has already committed.
  try {
    await notify(await adminUserIds(), {
      kind: "new_intake",
      title: `New website application: ${input.legalName}`,
      href: "/deals?type=mandate&stage=NewLead&source=Website",
    });
  } catch (err) {
    console.error("submitIntake: post-commit notification failed", err);
  }

  return mandate;
}
