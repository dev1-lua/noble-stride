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

export interface IntakeExtras {
  /** "wizard" (default) preserves today's behavior exactly; "webchat" is the Client Agent (SOW §8.1). */
  via?: "wizard" | "webchat";
  conversationSummary?: string;
  qualificationNotes?: string;
  attachmentUrls?: string[];
}

export async function submitIntake(raw: unknown, extras: IntakeExtras = {}): Promise<Mandate> {
  const via = extras.via ?? "wizard";
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
        createdSource: via === "webchat" ? "AGENT" : "API",
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
        createdSource: via === "webchat" ? "AGENT" : "API",
        qualificationVerdict: verdict,
        qualificationReasons: reasons,
        qualifiedAt: new Date(),
      },
    });

    const summaryBody =
      via === "webchat"
        ? [
            extras.conversationSummary,
            extras.qualificationNotes ? `Qualification signals (agent-flagged): ${extras.qualificationNotes}` : null,
          ]
            .filter(Boolean)
            .join("\n\n") || undefined
        : undefined;

    await tx.activity.create({
      data: {
        type: "Note",
        subject: via === "webchat" ? "Web chat intake received" : "Website intake received",
        body: summaryBody,
        channel: "WebChat",
        direction: "Inbound",
        clientId: client.id,
        mandateId: mandate.id,
        ...(via === "webchat" ? { createdSource: "AGENT" as const } : {}),
      },
    });

    if (via === "webchat") {
      await tx.task.create({
        data: {
          title: `Review web-chat intake: ${input.legalName}`,
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
    }

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
