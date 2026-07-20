// submit-website-intake.ts — testable core of the Website Intake &
// Qualification Agent (SOW §10). Parallel to submit-intake.ts (the /intake
// wizard + legacy Client Agent path) rather than a fork of it: §10.1
// requiredness differs from the wizard's schema, and the wizard must keep
// behaving exactly as today until it migrates (TODO-UPDATE-INTAKE-WIZARD.md).
//
// Same invariants as submit-intake.ts: a submission never auto-becomes an
// active deal — it lands as a Mandate in NewLead with a qualification verdict
// attached and a human assigns a deal lead (§10.3). The applicant never sees
// the verdict.

import type { Mandate } from "@prisma/client";
import { prisma } from "@/lib/db";
import { websiteIntakeSchema } from "@/lib/schemas/website-intake";
import { qualifyIntake, type IntakeQualInput } from "@/server/domain/qualification";
import { notify, adminUserIds } from "@/server/services/notifications";

export interface WebsiteIntakeExtras {
  conversationSummary?: string;
  qualificationNotes?: string;
  attachmentUrls?: string[];
}

const yesNoToBool = (v: "yes" | "no" | undefined): boolean | null =>
  v === undefined ? null : v === "yes";

export async function submitWebsiteIntake(raw: unknown, extras: WebsiteIntakeExtras = {}): Promise<Mandate> {
  const input = websiteIntakeSchema.parse(raw);

  // Absent optionals go in as null — qualifyIntake turns each into a
  // NeedsReview reason instead of a hard fail (§10.2: missing data is for
  // human review, never an auto-reject).
  const qualInput: IntakeQualInput = {
    revenueUsd: input.revenueUsd ?? null,
    raiseUsd: input.raiseUsd,
    auditedYears: input.auditedYears === undefined ? null : Number(input.auditedYears),
    countries: input.countries,
    sectors: input.sectors,
    pepExposure: yesNoToBool(input.pepExposure),
    governmentOwned: yesNoToBool(input.governmentOwned),
    ebitdaUsd: input.ebitdaUsd ?? null,
    yearFounded: input.yearFounded,
    currentYear: new Date().getFullYear(),
  };
  const { verdict, reasons } = qualifyIntake(qualInput);

  const mandateNotes = [
    input.useOfFunds ? `Use of funds: ${input.useOfFunds}` : null,
    input.proposedTimeline ? `Timeline: ${input.proposedTimeline}` : null,
    input.originationSource ? `Origination source: ${input.originationSource}` : null,
    input.applicantNotes ? `Applicant notes: ${input.applicantNotes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const mandate = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        name: input.legalName,
        yearFounded: input.yearFounded,
        hqCity: input.hqCity,
        hqCountry: input.hqCountry || undefined,
        countries: input.countries,
        sector: input.sectors,
        coreProduct: input.coreProduct,
        description: input.description,
        founderGenders: input.founderGenders,
        foundersNationality: input.foundersNationality,
        targetClients: input.targetClients,
        existingInvestors: input.existingInvestors || undefined,
        website: input.website || undefined,
        pitchDeckUrl: input.pitchDeckUrl || undefined,
        registrationNo: input.registrationNo || undefined,
        revenueLastYear: input.revenueUsd,
        revenueForecast: input.revenueForecastUsd,
        profitability: input.profitability,
        ebitda: input.ebitdaUsd,
        netProfit: input.netProfitUsd,
        totalAssets: input.totalAssetsUsd,
        loanBook: input.loanBookUsd,
        existingDebt: input.existingDebtUsd,
        raisedToDateTotal: input.raisedToDateTotalUsd,
        ownershipStructure: input.ownershipSummary || undefined,
        pepExposure: input.pepExposure === "yes",
        governmentOwned: input.governmentOwned === "yes",
        auditedFinancialsYears: input.auditedYears === undefined ? undefined : Number(input.auditedYears),
        status: "Prospect",
        source: "Website",
        createdSource: "AGENT",
        contacts: {
          create: {
            firstName: input.contactName,
            jobTitle: input.role,
            email: input.email,
            phone: input.phone || undefined,
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
        country: input.hqCountry || undefined,
        instrument: input.instruments,
        postMoneyValuation: input.postMoneyValuationUsd,
        raisedToDateRound: input.raisedToDateRoundUsd,
        intakeNdaAccepted: input.ndaAccepted,
        intakeNdaAcceptedAt: input.ndaAccepted ? new Date() : undefined,
        notes: mandateNotes || undefined,
        clientId: client.id,
        createdSource: "AGENT",
        qualificationVerdict: verdict,
        qualificationReasons: reasons,
        qualifiedAt: new Date(),
      },
    });

    const summaryBody =
      [
        extras.conversationSummary,
        extras.qualificationNotes ? `Qualification signals (agent-flagged): ${extras.qualificationNotes}` : null,
      ]
        .filter(Boolean)
        .join("\n\n") || undefined;

    await tx.activity.create({
      data: {
        type: "Note",
        subject: "Website intake agent submission",
        body: summaryBody,
        channel: "WebChat",
        direction: "Inbound",
        clientId: client.id,
        mandateId: mandate.id,
        createdSource: "AGENT",
      },
    });

    await tx.task.create({
      data: {
        title: `Review website intake: ${input.legalName}`,
        body: extras.conversationSummary,
        source: "Other",
        clientId: client.id,
        mandateId: mandate.id,
      },
    });

    const urls = extras.attachmentUrls ?? [];
    for (const [i, url] of urls.entries()) {
      await tx.document.create({
        data: {
          name: i === 0 ? `${input.legalName} — pitch deck (web chat)` : `${input.legalName} — web-chat attachment ${i + 1}`,
          type: i === 0 ? "PitchDeck" : "Other",
          accessLevel: "Internal",
          fileUrl: url,
          clientId: client.id,
          mandateId: mandate.id,
          createdSource: "AGENT",
        },
      });
    }
    if (urls[0] && !input.pitchDeckUrl) {
      await tx.client.update({ where: { id: client.id }, data: { pitchDeckUrl: urls[0] } });
    }

    return mandate;
  });

  // Best-effort, post-commit — same guard rationale as submitIntake's notify:
  // adminUserIds() runs outside notify's own try/catch and must never surface
  // a throw after the business transaction has committed.
  try {
    await notify(await adminUserIds(), {
      kind: "new_intake",
      title: `New website application: ${input.legalName}`,
      href: "/deals?type=mandate&stage=NewLead&source=Website",
    });
  } catch (err) {
    console.error("submitWebsiteIntake: post-commit notification failed", err);
  }

  return mandate;
}
